/**
 * Scheduled function — the Shakespeare chorus comments rarely on real
 * family posts. Source of Truth, Milestone 7.
 *
 * Cadence: every 30 minutes. Each fire considers all enabled bot
 * characters, looks at recent posts (>30 min old, <72 hr old) in
 * chorus-enabled families, and comments on at most one matching post
 * per bot per day. The trigger is keyword overlap with the bot's
 * interests + a probabilistic gate so even matches don't always fire.
 *
 * Tone discipline: never an exclamation mark, never confetti, never
 * advice. The chorus is a bystander in the room — well-read, gentle,
 * occasionally pointed. Read the bot's voice_prompt for the line.
 *
 * Fail-soft: if ANTHROPIC_API_KEY or CHORUS_PROFILE_ID env vars are
 * missing, the function logs the gap and exits 200. The infrastructure
 * is dormant until the user wires the keys.
 *
 * Refusal list (M7):
 *   - No bots impersonating real living people.
 *   - No bots impersonating real dead people. Shakespeare characters
 *     are fictional; that's the line.
 *   - No bot DMs.
 *   - No bot-to-bot conversations.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CHORUS_PROFILE_ID = process.env.CHORUS_PROFILE_ID;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

interface BotCharacter {
  id: string;
  slug: string;
  display_name: string;
  play: string | null;
  voice_prompt: string;
  interests: string[];
  daily_comment_budget: number;
  enabled: boolean;
}

interface PostRow {
  id: string;
  family_id: string;
  body: string | null;
  created_at: string;
  author_id: string;
}

// ── helpers ─────────────────────────────────────────────────────────

/** Token-loose interest match. Returns count of matches so we can
 *  rank posts that map most strongly to a bot's territory. */
function interestScore(body: string, interests: string[]): number {
  if (!body) return 0;
  const text = body.toLowerCase();
  let score = 0;
  for (const word of interests) {
    if (text.includes(word.toLowerCase())) score += 1;
  }
  return score;
}

/** Fire one chorus comment via Claude. Returns the generated body or
 *  null if the API call failed or the result didn't pass the quality
 *  filter (length, content). */
async function generateComment(bot: BotCharacter, postBody: string): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;

  const userMessage =
    `Family post you've just overheard:\n\n"${postBody.slice(0, 1500)}"\n\nWrite your one comment now.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        temperature: 0.95,
        system: bot.voice_prompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('[chorus] anthropic non-ok', res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as any;
    const text: string = json?.content?.[0]?.text ?? '';
    return qualityFilter(text);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn('[chorus] anthropic threw', e?.message);
    return null;
  }
}

/** Quality gate: length, no leading "I am", no exclamation marks
 *  (per tone spec), no off-topic political content (basic keyword
 *  match — not a content moderator, just a brake). Returns the
 *  cleaned comment or null if rejected. */
function qualityFilter(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 10) return null;
  if (trimmed.length > 600) return null;
  if (/!{1,}/.test(trimmed)) return null;
  if (/\b(politic|election|president|trump|biden|nazi|fascist|liberal|conservative)\b/i.test(trimmed)) {
    return null;
  }
  if (/^(as a|i am an? ai|i'm an? ai|i'm a fictional|as a fictional)/i.test(trimmed)) return null;
  // Strip surrounding quotes the model likes to add.
  return trimmed.replace(/^["'""]|["'""]$/g, '').trim();
}

/** Format the slugline + body into the comment that lands in the
 *  comments table. The slugline names the character so a reader can
 *  scan a thread and see who spoke; the body is the comment itself. */
function formatChorusComment(bot: BotCharacter, body: string): string {
  return `**${bot.display_name}** — ${body}`;
}

// ── main ────────────────────────────────────────────────────────────

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }
  if (!ANTHROPIC_KEY || !CHORUS_PROFILE_ID) {
    // eslint-disable-next-line no-console
    console.log('[chorus] dormant — set ANTHROPIC_API_KEY and CHORUS_PROFILE_ID env vars to enable');
    return new Response(JSON.stringify({ status: 'dormant' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Pull all enabled characters.
  const botsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bot_characters?select=*&enabled=eq.true`,
    { headers: HEADERS },
  );
  const bots = (await botsRes.json()) as BotCharacter[];
  if (!Array.isArray(bots) || bots.length === 0) {
    return new Response(JSON.stringify({ posted: 0, skipped: 'no bots' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Pull recent candidate posts: 30min - 72hr old, in chorus-
  //    enabled families, not already commented on by the chorus.
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const seventyTwoHrAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?select=id,family_id,body,created_at,author_id,family:families!family_id(chorus_enabled)&created_at=lte.${thirtyMinAgo}&created_at=gte.${seventyTwoHrAgo}&visibility=eq.family&order=created_at.desc&limit=200`,
    { headers: HEADERS },
  );
  const candidates = (await postsRes.json()) as Array<PostRow & { family: { chorus_enabled: boolean } | null }>;
  if (!Array.isArray(candidates)) {
    return new Response(JSON.stringify({ error: 'posts query failed' }), { status: 500 });
  }
  const eligible = candidates.filter(
    (p) => p.body && p.family?.chorus_enabled !== false && p.author_id !== CHORUS_PROFILE_ID,
  );

  let posted = 0;
  let skipped = 0;

  for (const bot of bots) {
    // Has this bot already commented today? Daily budget.
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dailyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_comments_log?select=id&bot_character_id=eq.${bot.id}&posted_at=gte.${dayStart.toISOString()}`,
      { headers: HEADERS },
    );
    const dailyRows = (await dailyRes.json()) as Array<{ id: string }>;
    if (Array.isArray(dailyRows) && dailyRows.length >= bot.daily_comment_budget) {
      skipped += 1;
      continue;
    }

    // Pick the post with highest interest overlap.
    const ranked = eligible
      .map((p) => ({ post: p, score: interestScore(p.body ?? '', bot.interests) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      skipped += 1;
      continue;
    }

    // Probabilistic gate: even when there's a match, only ~50% of the
    // time. The chorus is rare. (No "always speak when you have an
    // opinion" — that's noise.)
    if (Math.random() < 0.5) {
      skipped += 1;
      continue;
    }

    // Has the chorus already commented on this post? Don't pile on.
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/bot_comments_log?select=id&post_id=eq.${ranked[0].post.id}`,
      { headers: HEADERS },
    );
    const existingRows = (await existing.json()) as Array<{ id: string }>;
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      skipped += 1;
      continue;
    }

    const top = ranked[0].post;
    const generated = await generateComment(bot, top.body ?? '');
    if (!generated) {
      skipped += 1;
      continue;
    }

    const commentBody = formatChorusComment(bot, generated);

    // Insert the comment as the chorus profile.
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({
        post_id: top.id,
        author_id: CHORUS_PROFILE_ID,
        body: commentBody,
      }),
    });
    if (!cRes.ok) {
      // eslint-disable-next-line no-console
      console.warn('[chorus] comment insert failed', cRes.status, await cRes.text());
      skipped += 1;
      continue;
    }
    const inserted = ((await cRes.json()) as any[])[0];

    await fetch(`${SUPABASE_URL}/rest/v1/bot_comments_log`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        bot_character_id: bot.id,
        post_id: top.id,
        comment_id: inserted?.id ?? null,
        generation_model: ANTHROPIC_MODEL,
        generation_prompt: bot.voice_prompt.slice(0, 500),
      }),
    });

    posted += 1;
  }

  return new Response(
    JSON.stringify({ posted, skipped, candidates: eligible.length, bots: bots.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** Every 30 minutes. The chorus is rare; the cadence is meant to give
 *  the function many chances to NOT speak. */
export const config: Config = {
  schedule: '*/30 * * * *',
};
