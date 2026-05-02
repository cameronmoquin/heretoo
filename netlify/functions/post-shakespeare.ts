/**
 * Scheduled function — drips one Shakespeare quote into the public
 * feed three times a day. Picks the quote with the oldest
 * `last_posted_at` (nulls first), inserts a post under the
 * @shakespeare bot, and updates the timestamp.
 *
 * Schedule (UTC): 09:00 / 14:00 / 19:00 — roughly morning, midday,
 * evening across the eastern hemispheres. Adjust the cron string
 * below to taste.
 *
 * Runs as service role so it bypasses the family-membership posting
 * gate. Service-role key is set via Netlify env vars (already in
 * place from Mux uploads).
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BOT_HANDLE = 'shakespeare';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Resolve the bot's profile id from the handle.
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${BOT_HANDLE}&select=id&limit=1`,
    { headers: HEADERS },
  );
  const profileRows = await profileRes.json();
  const botId = profileRows?.[0]?.id;
  if (!botId) {
    return new Response(`Bot @${BOT_HANDLE} not found. Run scripts/seed-shakespeare.mjs first.`, { status: 500 });
  }

  // 2. Pick the quote with the oldest last_posted_at (nulls first).
  const pickRes = await fetch(
    `${SUPABASE_URL}/rest/v1/shakespeare_quotes` +
      `?select=id,quote,character,play` +
      `&order=last_posted_at.asc.nullsfirst` +
      `&limit=1`,
    { headers: HEADERS },
  );
  const picked = await pickRes.json();
  const q = picked?.[0];
  if (!q) {
    return new Response('No quotes available — seed the catalogue first.', { status: 500 });
  }

  // 3. Insert the post.
  const body = `"${q.quote}"\n\n— ${q.character}, ${q.play}`;
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify({
      author_id: botId,
      body,
      visibility: 'public',
      kind: 'post',
    }),
  });
  if (!postRes.ok) {
    const t = await postRes.text();
    return new Response(`post insert failed: ${t}`, { status: 500 });
  }
  const postRow = (await postRes.json())?.[0];

  // 4. Mark the quote as posted now.
  await fetch(
    `${SUPABASE_URL}/rest/v1/shakespeare_quotes?id=eq.${q.id}`,
    {
      method: 'PATCH',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        last_posted_at: new Date().toISOString(),
        post_id: postRow?.id,
      }),
    },
  );

  return new Response(
    JSON.stringify({ posted: q.character, play: q.play, post_id: postRow?.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/**
 * Netlify Scheduled Function — fires three times a day UTC.
 *   09:00 UTC — morning (Europe lunchtime, Asia evening)
 *   14:00 UTC — midday (US east-coast morning)
 *   19:00 UTC — evening (US east-coast afternoon)
 *
 * Edit the cron expression to retime if needed.
 */
export const config: Config = {
  schedule: '0 9,14,19 * * *',
};
