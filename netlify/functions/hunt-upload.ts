/**
 * /api/hunt-upload — upload a Deaddrop photo using the service role.
 *
 * Storage RLS on storage.objects is awkward to provision per-project, so
 * the clue/proof photo upload goes through here instead of a direct
 * client storage write. We verify the caller is signed in, then upload
 * with the service role (which bypasses RLS) into the hunt-photos
 * bucket. The path is derived server-side from the verified user id.
 *
 * Request:  POST /api/hunt-upload?cacheId=<uuid>&kind=clue|find&ext=jpg
 *           Authorization: Bearer <user access token>
 *           Content-Type: image/*   body = raw image bytes
 * Response: { path: "<cacheId>/<name>" }
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'hunt-photos';
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — a phone photo, generously.

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'Server not configured' }, 503);

  // Verify the caller is a signed-in user.
  const auth = req.headers.get('authorization');
  if (!auth) return json({ error: 'Not signed in' }, 401);
  let userId: string | null = null;
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (u.ok) userId = ((await u.json()) as any)?.id ?? null;
  } catch {}
  if (!userId) return json({ error: 'Not signed in' }, 401);

  // Inputs.
  const url = new URL(req.url);
  const cacheId = url.searchParams.get('cacheId') || '';
  const kindParam = url.searchParams.get('kind');
  const kind = kindParam === 'find' ? 'find' : kindParam === 'payload' ? 'payload' : 'clue';
  const ext = (url.searchParams.get('ext') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  if (!/^[0-9a-fA-F-]{10,40}$/.test(cacheId)) return json({ error: 'bad cacheId' }, 400);

  // The payload is the sealed thing itself (090): private bucket, read
  // gated to the hider and to claimed finders. Only the cache's creator
  // may write it — any signed-in user writing another hider's payload
  // would be planting evidence.
  const bucket = kind === 'payload' ? 'hunt-payloads' : BUCKET;
  if (kind === 'payload') {
    const own = await fetch(
      `${SUPABASE_URL}/rest/v1/hunt_caches?id=eq.${cacheId}&creator_id=eq.${userId}&select=id`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE } },
    );
    const rows = own.ok ? ((await own.json()) as any[]) : [];
    if (rows.length === 0) return json({ error: 'not your drop' }, 403);
  }

  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0) return json({ error: 'empty body' }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: 'file too large' }, 413);

  const name = kind === 'clue' ? `clue.${ext}` : kind === 'payload' ? `payload.${ext}` : `find-${userId}.${ext}`;
  const path = `${cacheId}/${name}`;

  // Upload via the service role (bypasses storage RLS). x-upsert lets a
  // retake overwrite the same path.
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': req.headers.get('content-type') || 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body,
  });
  if (!up.ok) {
    const t = await up.text();
    return json({ error: `Upload failed: ${t.slice(0, 200)}` }, 502);
  }

  return json({ path }, 200);
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = { path: '/api/hunt-upload' };
