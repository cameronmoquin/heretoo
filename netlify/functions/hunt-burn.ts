/**
 * /api/hunt-burn — destroy a self-destructing deaddrop after it is found.
 *
 * Authorized to the finder: the caller must have a hunt_finds row for the
 * cache (proving they reached it). On burn we set the cache inactive and
 * delete the clue photo object with the service role, so the payload is
 * actually gone, not just hidden.
 *
 * Request:  POST /api/hunt-burn   { cache_id }
 *           Authorization: Bearer <user access token>
 * Response: { ok: true }
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'hunt-photos';

async function rest(path: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE as string,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'Server not configured' }, 503);

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

  let body: { cache_id?: string };
  try { body = await req.json(); } catch { body = {}; }
  const cacheId = body.cache_id;
  if (!cacheId) return json({ error: 'cache_id required' }, 400);

  // The caller must have found this cache.
  const findRes = await rest(
    `hunt_finds?cache_id=eq.${cacheId}&finder_id=eq.${userId}&select=id`,
    { method: 'GET' },
  );
  const finds = findRes.ok ? ((await findRes.json()) as any[]) : [];
  if (!finds.length) return json({ error: 'You have not found this drop' }, 403);

  // Fetch the photo path, then deactivate the cache.
  const cRes = await rest(`hunt_caches?id=eq.${cacheId}&select=photo_path`, { method: 'GET' });
  const photoPath = cRes.ok ? ((await cRes.json()) as any[])[0]?.photo_path : null;

  await rest(`hunt_caches?id=eq.${cacheId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  });

  // Delete the clue photo object so the payload is truly gone.
  if (photoPath) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${photoPath}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    }).catch(() => {});
  }

  return json({ ok: true }, 200);
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = { path: '/api/hunt-burn' };
