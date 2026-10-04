/**
 * drop-purge — makes the expiry and the burn physical.
 *
 * Hourly. Two jobs, in order:
 *
 *   1. EXPIRED DROPS. Any posts row whose expires_at has passed is
 *      hard-deleted — hearts and comments go with it (the same cascade
 *      the delete button uses). Its media paths are enqueued first so
 *      the blobs follow. Submits carry expires_at = null and can never
 *      be selected here, structurally.
 *
 *   2. THE QUEUE. Every unpurged purge_queue row (from a burn, or from
 *      step 1) gets its actual bytes destroyed: storage objects deleted
 *      from the posts bucket, Mux videos deleted via the Mux API. A row
 *      is only marked purged when the delete actually succeeded; a
 *      failure stays queued and retries next hour.
 *
 * ARMED. False ships first: every cycle logs exactly what it WOULD
 * delete and touches nothing. Flip to true after the candidate lists
 * have been read and believed. This is the only switch.
 *
 * Touches: posts (expired only), purge_queue, the posts storage bucket,
 * Mux assets named by the queue. Nothing else, by construction.
 */

import type { Config } from '@netlify/functions';

// Armed Aug 6 2026 after the dry-run review: zero expired candidates,
// 375 no-expiry posts structurally unselectable, queue empty.
const ARMED = true;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID ?? '';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET ?? '';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};
const muxAuth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64');

const tag = ARMED ? '[drop-purge]' : '[drop-purge DRY-RUN]';

/** Delete one storage object from the posts bucket. True on success. */
async function deleteStorageObject(path: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/posts/${path}`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  // 200 deleted; 404 already gone, which is the goal state too.
  return r.ok || r.status === 404;
}

/** Resolve a Mux playback id to its asset and delete it. True on success. */
async function deleteMuxAsset(playbackId: string): Promise<boolean> {
  const lookup = await fetch(`https://api.mux.com/video/v1/playback-ids/${playbackId}`, {
    headers: { Authorization: `Basic ${muxAuth}` },
  });
  if (lookup.status === 404) return true; // already gone
  if (!lookup.ok) return false;
  const d = (await lookup.json()) as { data?: { object?: { id?: string; type?: string } } };
  const assetId = d.data?.object?.type === 'asset' ? d.data.object.id : null;
  if (!assetId) return false;
  const del = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${muxAuth}` },
  });
  return del.ok || del.status === 404;
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`${tag} not configured`);
    return new Response('not configured', { status: 500 });
  }

  // ── 1. Expired drops ────────────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const er = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?expires_at=lt.${nowIso}`
    + `&select=id,expires_at,burned_at,visibility,media:post_media(storage_path,media_type)`
    + `&limit=200`,
    { headers: HEADERS },
  );
  if (!er.ok) {
    console.error(`${tag} expired lookup failed`, er.status, await er.text());
    return new Response('lookup failed', { status: 500 });
  }
  const expired = (await er.json()) as Array<{
    id: string; expires_at: string; burned_at: string | null; visibility: string;
    media: Array<{ storage_path: string; media_type: string | null }>;
  }>;

  for (const p of expired) {
    console.log(
      `${tag} expired drop ${p.id} (${p.visibility}, expired ${p.expires_at},`
      + ` ${p.media?.length ?? 0} blob(s)${p.burned_at ? ', was burned' : ''})`,
    );
    if (!ARMED) continue;

    // Enqueue the blobs, then delete the row. Queue first: a crash
    // between the two leaves a queued path pointing at a live row,
    // which re-resolves next hour — never an orphaned blob.
    for (const m of p.media ?? []) {
      const q = await fetch(`${SUPABASE_URL}/rest/v1/purge_queue`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({ post_id: p.id, storage_path: m.storage_path, media_type: m.media_type }),
      });
      if (!q.ok) console.error(`${tag} enqueue failed for ${m.storage_path}`, q.status);
    }
    const dr = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${p.id}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    if (!dr.ok) console.error(`${tag} delete failed for post ${p.id}`, dr.status, await dr.text());
  }

  // ── 2. The queue ────────────────────────────────────────────────────
  const qr = await fetch(
    `${SUPABASE_URL}/rest/v1/purge_queue?purged_at=is.null&select=id,storage_path,media_type&order=queued_at&limit=200`,
    { headers: HEADERS },
  );
  // 404 / 42P01: migration 075 has not run yet. Log-and-done, no error —
  // the expired scan above still reported.
  let queue: Array<{ id: string; storage_path: string; media_type: string | null }> = [];
  if (qr.ok) queue = await qr.json();
  else console.log(`${tag} purge_queue unavailable (${qr.status}) — migration 075 not run yet?`);

  let purged = 0;
  for (const row of queue) {
    console.log(`${tag} blob ${row.storage_path} (${row.media_type ?? 'unknown'})`);
    if (!ARMED) continue;

    const ok = row.storage_path.startsWith('mux:')
      ? await deleteMuxAsset(row.storage_path.slice(4))
      : await deleteStorageObject(row.storage_path);

    if (!ok) {
      console.error(`${tag} blob delete failed, staying queued: ${row.storage_path}`);
      continue;
    }
    const mr = await fetch(`${SUPABASE_URL}/rest/v1/purge_queue?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({ purged_at: new Date().toISOString() }),
    });
    if (mr.ok) purged += 1;
  }

  const summary = `${tag} ${expired.length} expired, ${queue.length} queued blobs, ${purged} purged`;
  console.log(summary);
  return new Response(summary);
};

export const config: Config = {
  schedule: '0 * * * *',
};
