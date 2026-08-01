/**
 * Netlify function: server-side Mux direct-upload creator.
 *
 * Path: /.netlify/functions/mux-upload-create
 *
 * Two operations, dispatched by request body:
 *   POST  {}                                  → create new direct upload
 *   POST  { action: 'check', uploadId }       → poll status / fetch asset
 *
 * Required Netlify env vars:
 *   MUX_TOKEN_ID
 *   MUX_TOKEN_SECRET
 *   SUPABASE_URL                  (for verifying the caller's JWT)
 *   SUPABASE_SERVICE_ROLE_KEY     (for the auth/v1/user check)
 *
 * The Mux API tokens never reach the browser. The client sends its
 * Supabase access token; we verify it before talking to Mux.
 */

import type { Handler } from '@netlify/functions';

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID ?? '';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET ?? '';
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const MUX_BASE = 'https://api.mux.com';
const muxAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const json = (status: number, body: unknown) => ({
  statusCode: status,
  headers: cors,
  body: JSON.stringify(body),
});

async function verifyJwt(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = (await r.json()) as { id?: string };
  return u.id ?? null;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    return json(500, { error: 'Mux not configured. Set MUX_TOKEN_ID + MUX_TOKEN_SECRET on Netlify.' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: 'Supabase not configured on server.' });
  }

  const userId = await verifyJwt(event.headers.authorization ?? event.headers.Authorization);
  if (!userId) return json(401, { error: 'Unauthorized' });

  let body: { action?: string; uploadId?: string } = {};
  try { body = JSON.parse(event.body ?? '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  // ── status check ──
  if (body.action === 'check' && body.uploadId) {
    const r = await fetch(`${MUX_BASE}/video/v1/uploads/${body.uploadId}`, {
      headers: { Authorization: `Basic ${muxAuth}` },
    });
    if (!r.ok) return json(502, { error: `Mux status check failed (${r.status})` });
    const d = (await r.json()) as { data?: { asset_id?: string; status?: string } };
    if (d.data?.asset_id) {
      const ar = await fetch(`${MUX_BASE}/video/v1/assets/${d.data.asset_id}`, {
        headers: { Authorization: `Basic ${muxAuth}` },
      });
      if (!ar.ok) return json(502, { error: 'Failed to fetch Mux asset' });
      const ad = (await ar.json()) as { data?: { status?: string } };
      // Only hand back a READY asset. An asset gets its id and playback
      // id while it is still preparing, and the MP4 rendition does not
      // exist yet at that point, so returning early posts a video that
      // 404s on play. Keep the client polling until Mux is done.
      if (ad.data?.status && ad.data.status !== 'ready') {
        if (ad.data.status === 'errored') {
          return json(200, { asset: null, status: 'errored' });
        }
        return json(200, { asset: null, status: ad.data.status });
      }
      return json(200, { asset: ad.data });
    }
    return json(200, { asset: null, status: d.data?.status ?? 'pending' });
  }

  // ── create new direct upload ──
  const r = await fetch(`${MUX_BASE}/video/v1/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${muxAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      new_asset_settings: {
        playback_policy: ['public'],
        // Generate an MP4 rendition so browsers without HLS support
        // (Chrome, most non-Safari) can <video src> the file directly.
        //
        // This is static_renditions, NOT the old mp4_support. Mux
        // deprecated mp4_support and now rejects it outright:
        // "Deprecated 'standard' mp4_support is not allowed on basic
        // assets". That 400 killed the create call before a single byte
        // uploaded, so no video ever landed. Verified against the live
        // Mux API: mp4_support 400s, static_renditions 201s.
        //
        // The resulting file is named highest.mp4, so playback reads
        // stream.mux.com/<playbackId>/highest.mp4 (see mediaPathToUrl).
        static_renditions: [{ resolution: 'highest' }],
      },
      cors_origin: '*',
    }),
  });
  if (!r.ok) {
    const text = await r.text();
    return json(502, { error: `Mux upload creation failed: ${text}` });
  }
  const d = (await r.json()) as { data?: { url?: string; id?: string } };
  if (!d.data?.url || !d.data?.id) return json(502, { error: 'Mux returned malformed response' });
  return json(200, { uploadUrl: d.data.url, uploadId: d.data.id });
};
