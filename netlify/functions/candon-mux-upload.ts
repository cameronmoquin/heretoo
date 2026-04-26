// Netlify serverless function: /.netlify/functions/candon-mux-upload
//
// Creates a Mux direct-upload URL on behalf of an authenticated user.
// The Mux API tokens stay on the server — they never reach the browser.
//
// Required env vars on Netlify:
//   MUX_TOKEN_ID, MUX_TOKEN_SECRET   - server-only Mux API token
//   SUPABASE_URL                     - same project the app uses
//   SUPABASE_SERVICE_ROLE_KEY        - to verify the caller's JWT
//
// Two operations, distinguished by request body:
//   POST  {}                         → create new direct upload
//   POST  { action: 'check', uploadId } → poll upload status / fetch asset

import type { Handler } from '@netlify/functions';

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID ?? '';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET ?? '';
const MUX_BASE_URL = 'https://api.mux.com';
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const muxAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(status: number, body: unknown) {
  return { statusCode: status, headers: corsHeaders, body: JSON.stringify(body) };
}

async function verifyAuth(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    return json(500, { error: 'Mux credentials not configured on server' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: 'Supabase credentials not configured on server' });
  }

  const userId = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
  if (!userId) return json(401, { error: 'Unauthorized' });

  let body: { action?: string; uploadId?: string } = {};
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  // ── Status check ──
  if (body.action === 'check' && body.uploadId) {
    const res = await fetch(`${MUX_BASE_URL}/video/v1/uploads/${body.uploadId}`, {
      headers: { Authorization: `Basic ${muxAuth}` },
    });
    if (!res.ok) {
      return json(502, { error: `Mux status check failed: ${res.status}` });
    }
    const data = (await res.json()) as { data?: { asset_id?: string; status?: string } };
    if (data.data?.asset_id) {
      const assetRes = await fetch(`${MUX_BASE_URL}/video/v1/assets/${data.data.asset_id}`, {
        headers: { Authorization: `Basic ${muxAuth}` },
      });
      if (!assetRes.ok) return json(502, { error: 'Failed to fetch Mux asset' });
      const assetData = (await assetRes.json()) as { data?: unknown };
      return json(200, { asset: assetData.data });
    }
    return json(200, { asset: null, status: data.data?.status ?? 'pending' });
  }

  // ── Create new direct upload ──
  const res = await fetch(`${MUX_BASE_URL}/video/v1/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${muxAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      new_asset_settings: {
        playback_policy: ['public'],
        encoding_tier: 'baseline',
      },
      cors_origin: '*',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json(502, { error: `Mux upload creation failed: ${text}` });
  }

  const data = (await res.json()) as { data?: { url?: string; id?: string } };
  if (!data.data?.url || !data.data?.id) {
    return json(502, { error: 'Mux returned malformed upload response' });
  }

  return json(200, { uploadUrl: data.data.url, uploadId: data.data.id });
};
