/**
 * Scheduled function — drips one Shakespeare quote into the public
 * feed three times a day, posting AS the speaking character (not as
 * a generic @shakespeare account).
 *
 * Stage A of the Shakespeare-bots feature: each major character has
 * their own bot profile (@hamlet, @lady_macbeth, @falstaff, etc.).
 * Quote bodies are now just the line itself; attribution lives in the
 * slugline ("— Hamlet · Hamlet · Act III, Sc. i") rendered bottom-
 * right on the PostCard.
 *
 * Self-bootstrapping: the first time a quote is posted from a new
 * character, this function creates the auth user + profile on demand.
 * No separate seed run required. Falls back to @shakespeare if the
 * character lookup/creation fails (for whatever reason — Supabase
 * outage on the admin API, etc.).
 *
 * Schedule (UTC): 09:00 / 14:00 / 19:00 — roughly morning, midday,
 * evening across the eastern hemispheres.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FALLBACK_BOT_HANDLE = 'shakespeare';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

/**
 * Turn a character name like "Lady Macbeth" or "The Witches" into a
 * valid handle ("lady_macbeth", "the_witches"). Lowercase, underscored,
 * stripped of punctuation. Bounded at 24 chars to match the profile
 * handle constraint.
 */
function characterToHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 24);
}

/**
 * Format the play reference into a tighter slugline form.
 * "Hamlet, Act 3 Scene 1" → "Hamlet · III.i"
 * "Romeo and Juliet, Act 2 Scene 2" → "Romeo and Juliet · II.ii"
 */
function formatSlugline(character: string, play: string): string {
  // Convert "Act N Scene M" → roman numerals + dot.
  const ROMAN: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII',
  };
  const m = play.match(/^(.+?),\s*Act\s+(\d+)\s+Scene\s+(\d+)/i);
  if (m) {
    const work = m[1].trim();
    const act = ROMAN[Number(m[2])] ?? m[2];
    const scene = ROMAN[Number(m[3])] ?? m[3];
    return `— ${character} · ${work} · ${act}.${scene.toLowerCase()}`;
  }
  // Fallback: keep it readable even if regex misses.
  return `— ${character} · ${play}`;
}

/**
 * Work title = the play string up to the first comma. The play column
 * embeds act and scene ("Macbeth, Act 2 Scene 1"), and multi-part
 * histories carry the part too ("Henry IV, Part 1, Act 5 Scene 4"), so
 * the work is everything before that first comma. Both parts of a
 * history collapse to one work. Bare works like "Sonnets" pass whole.
 */
function workOf(play: string): string {
  return (play ?? '').split(',')[0].trim();
}

/** Find the bot profile for a given character — create it if absent. */
async function findOrCreateCharacterBot(character: string): Promise<string | null> {
  const handle = characterToHandle(character);
  if (!handle) return null;

  // Existing profile?
  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${handle}&select=id&limit=1`,
    { headers: HEADERS },
  );
  const found = await lookup.json();
  if (found?.[0]?.id) return found[0].id;

  // Need to create. Bot accounts go through auth.users so the profile
  // FK + RLS still work. Service role can do this via the admin API.
  const email = `bot+${handle}@bot.heretoo.social`;
  const password = `bot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { handle, display_name: character, is_bot: true },
    }),
  });
  if (!create.ok) {
    // If the email already exists we can recover by listing users, but
    // in general just bail and the caller falls back to @shakespeare.
    // eslint-disable-next-line no-console
    console.error(`[post-shakespeare] create bot failed for ${character}:`, await create.text());
    return null;
  }
  const cj = await create.json();
  const userId: string | undefined = cj.id ?? cj.user?.id;
  if (!userId) return null;

  // The handle_new_user trigger pre-populates the profile row. Patch
  // the handle / display_name / bio so the bot reads correctly.
  await new Promise((r) => setTimeout(r, 400));
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      handle,
      display_name: character,
      bio: `Character voice from Shakespeare. Posting lines as they were spoken.`,
    }),
  });
  return userId;
}

/** Resolve a profile id by handle — used for the @shakespeare fallback. */
async function resolveBotByHandle(handle: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${handle}&select=id&limit=1`,
    { headers: HEADERS },
  );
  const rows = await res.json();
  return rows?.[0]?.id ?? null;
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }

  // 1. Spread across plays. Long same-play runs happen because oldest-
  // first ordering walks every scene of one work before moving to the
  // next. So read the works of the most recently posted quotes, then
  // pick the oldest quote whose work is NOT among them.
  const RECENT_WINDOW = 12;
  const AVOID_WORKS = 3;

  const recentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/shakespeare_quotes` +
      `?select=play` +
      `&order=last_posted_at.desc.nullslast` +
      `&limit=${RECENT_WINDOW}`,
    { headers: HEADERS },
  );
  const recentRows = await recentRes.json();
  const recentWorks: string[] = [];
  if (Array.isArray(recentRows)) {
    for (const r of recentRows) {
      const w = workOf(r.play);
      if (w && !recentWorks.includes(w)) recentWorks.push(w);
      if (recentWorks.length >= AVOID_WORKS) break;
    }
  }

  // Exclude by work, not by raw play string. One work spans many play
  // strings (a row per scene, plus Part 1 / Part 2), so match the work
  // at its comma boundary ("Macbeth,%") and the bare-work form for
  // Sonnets. encodeURIComponent keeps spaces, apostrophes, and the comma
  // intact; the trailing * is the LIKE wildcard and stays literal.
  // Repeated filters on one column are AND-combined by PostgREST.
  const exclude = recentWorks
    .map(
      (w) =>
        `&play=not.eq.${encodeURIComponent(w)}` +
        `&play=not.like.${encodeURIComponent(`${w},`)}*`,
    )
    .join('');

  const SELECT = `?select=id,quote,character,play`;
  const OLDEST_FIRST = `&order=last_posted_at.asc.nullsfirst&limit=1`;

  // Primary pick: oldest quote from a work we have not just posted.
  let picked: any;
  if (exclude) {
    const spreadRes = await fetch(
      `${SUPABASE_URL}/rest/v1/shakespeare_quotes${SELECT}${exclude}${OLDEST_FIRST}`,
      { headers: HEADERS },
    );
    picked = await spreadRes.json();
  }

  // Fallback: tiny catalogue, or every work posted recently. Keep the
  // daily drip alive with the plain oldest-first pick.
  if (!Array.isArray(picked) || !picked[0]) {
    const plainRes = await fetch(
      `${SUPABASE_URL}/rest/v1/shakespeare_quotes${SELECT}${OLDEST_FIRST}`,
      { headers: HEADERS },
    );
    picked = await plainRes.json();
  }

  const q = picked?.[0];
  if (!q) {
    return new Response('No quotes available — seed the catalogue first.', { status: 500 });
  }

  // 2. Find / create the character's bot profile. Fall back to the
  // generic @shakespeare account if anything goes wrong, so the daily
  // drip never silently fails.
  const characterBotId = await findOrCreateCharacterBot(q.character);
  const authorId = characterBotId ?? (await resolveBotByHandle(FALLBACK_BOT_HANDLE));
  if (!authorId) {
    return new Response(
      `No author bot available — couldn't create one for "${q.character}" and @${FALLBACK_BOT_HANDLE} doesn't exist.`,
      { status: 500 },
    );
  }

  // 3. Insert the post. Body is the pure quote (with smart-quotes left
  // intact); slugline carries the attribution.
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify({
      author_id: authorId,
      body: q.quote,
      slugline: formatSlugline(q.character, q.play),
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
    JSON.stringify({
      character: q.character,
      handle: characterToHandle(q.character),
      play: q.play,
      slugline: formatSlugline(q.character, q.play),
      post_id: postRow?.id,
      author_id: authorId,
      character_bot_used: !!characterBotId,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = {
  schedule: '0 9,14,19 * * *',
};
