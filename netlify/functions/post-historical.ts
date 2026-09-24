/**
 * Scheduled function — the historical faculty teaches the feed.
 *
 * Three times a day, one figure posts one first-person fact drawn from
 * the FSOT knowledge bank (public.fsot_questions). The bank is walked
 * oldest-taught-first, the row is routed to the figure whose record it
 * belongs to (lib/historical-figures.ts), and the model writes the
 * figure's voice UNDER THE VOICE RULES — every claim from the row,
 * nothing invented. Attribution rides the slugline, Shakespeare-style:
 * "— Harry S. Truman · US History".
 *
 * Bot profiles bootstrap on demand exactly as post-shakespeare's did:
 * auth admin user + profile patch, bio labeling the account as an
 * educational voice. Fail-soft everywhere: no bank, no key, no model —
 * the run reports and exits; the feed is never handed a broken post.
 *
 * Replaces post-shakespeare.ts (retired 2026-09-16 at Cameron's word).
 */

import type { Config } from '@netlify/functions';
import { VOICE_RULES, routeFigure, FIGURES, BANK_TOPICS, isFacultyTopic, type Figure } from '../../lib/historical-figures';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

/** Find the figure's bot profile — create it if absent. Same admin-API
 *  bootstrap post-shakespeare used; the trigger fills the profile row
 *  and the patch names it. */
async function findOrCreateFigureBot(figure: Figure): Promise<string | null> {
  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?handle=eq.${figure.handle}&select=id&limit=1`,
    { headers: HEADERS },
  );
  const found = await lookup.json();
  if (found?.[0]?.id) return found[0].id;

  const email = `bot+${figure.handle}@bot.heretoo.social`;
  const password = `bot-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const create = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { handle: figure.handle, display_name: figure.name, is_bot: true },
    }),
  });
  if (!create.ok) {
    // eslint-disable-next-line no-console
    console.error(`[post-historical] create bot failed for ${figure.name}:`, await create.text());
    return null;
  }
  const cj = await create.json();
  const userId: string | undefined = cj.id ?? cj.user?.id;
  if (!userId) return null;

  await new Promise((r) => setTimeout(r, 400));
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      handle: figure.handle,
      display_name: figure.name,
      bio: figure.bio,
    }),
  });
  return userId;
}

/** One generation under the voice rules. Null on any failure — the
 *  caller skips the run rather than posting something unruled. */
async function writePost(figure: Figure, row: any): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  const options = Array.isArray(row.options) ? row.options : [];
  const answerText = typeof row.answer === 'number' ? options[row.answer] : null;

  const source = [
    `TOPIC: ${row.topic}${row.subtopic ? ` / ${row.subtopic}` : ''}`,
    `FACT (question form): ${row.prompt}`,
    answerText ? `THE CORRECT ANSWER: ${answerText}` : null,
    row.explanation ? `EXPLANATION (your source material): ${row.explanation}` : null,
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        temperature: 0.7,
        system: `${VOICE_RULES}\n\nYOU ARE: ${figure.name} (${figure.years}). ${figure.dossier}`,
        messages: [{
          role: 'user',
          content: `Write one feed post teaching this fact in your own voice. The reader is studying for the Foreign Service exam; make the fact stick.\n\n${source}\n\nReply with the post body only — no attribution line, no quotation marks around the whole.`,
        }],
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('[post-historical] model error', res.status, await res.text());
      return null;
    }
    const j = await res.json();
    const text: string | undefined = j?.content?.[0]?.text;
    if (!text || text.trim().length < 20 || text.length > 1200) return null;
    return text.trim();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[post-historical] model threw', e);
    return null;
  }
}

/**
 * How many recent posts count as "just spoken" / "just covered".
 *
 * RECENT_TOPICS is one less than the number of topics ON PURPOSE: a
 * topic waits until every other topic has had a turn, which makes the
 * curriculum a strict round-robin. At 4 it was not enough — every row
 * in a fresh bank ties on age, so ties resolved to the same five topics
 * forever and the last four never appeared at all. Measured: 48 posts,
 * 5 topics, Geography and Logical Reasoning never once.
 */
const RECENT_VOICES = 6;
const RECENT_TOPICS = 8;

/**
 * What the faculty has said lately — which voices, and which topics.
 *
 * BOTH are needed. Avoiding repeat VOICES alone still drains one topic:
 * every row in a freshly seeded bank is never-taught, so the same topic
 * sorts first every wake, and a topic with five qualified narrators
 * simply cycles those five for its whole block. Measured: forty
 * consecutive posts, all Economics. Avoiding repeat TOPICS is what
 * actually moves the curriculum around.
 *
 * Read from the posts themselves rather than held in memory, because
 * this function is serverless and keeps no state between wakes. The
 * topic rides the slugline the drip writes: "— Name · Topic".
 */
async function recentContext(): Promise<{ handles: Set<string>; topics: Set<string> }> {
  const empty = { handles: new Set<string>(), topics: new Set<string>() };
  try {
    const handles = FIGURES.map((f) => f.handle).join(',');
    const profs = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?handle=in.(${handles})&select=id,handle`,
      { headers: HEADERS },
    ).then((r) => r.json());
    if (!Array.isArray(profs) || profs.length === 0) return empty;
    const byId = new Map<string, string>(profs.map((p: any) => [p.id, p.handle]));
    const ids = [...byId.keys()].join(',');
    const limit = Math.max(RECENT_VOICES, RECENT_TOPICS);
    const posts = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?author_id=in.(${ids})` +
        `&select=author_id,slugline&order=created_at.desc&limit=${limit}`,
      { headers: HEADERS },
    ).then((r) => r.json());
    if (!Array.isArray(posts)) return empty;
    return {
      handles: new Set(
        posts.slice(0, RECENT_VOICES).map((p: any) => byId.get(p.author_id)).filter(Boolean) as string[],
      ),
      topics: new Set(
        posts.slice(0, RECENT_TOPICS)
          .map((p: any) => String(p.slugline ?? '').split('·').pop()?.trim())
          .filter((t: string | undefined): t is string => !!t),
      ),
    };
  } catch {
    // A failed lookup must never stop the drip. Empty sets simply mean
    // "nothing recent", and selection falls back to oldest-first.
    return empty;
  }
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }
  if (!ANTHROPIC_KEY) {
    return new Response('Dormant: no ANTHROPIC_API_KEY.', { status: 200 });
  }

  // 1. ONE CANDIDATE PER TOPIC, each the least-recently-taught of its
  // own topic.
  //
  // THE HAMILTON PROBLEM, and why the obvious fix was not enough. This
  // began as limit=1. The bank was seeded in one go, so every
  // last_posted_at was null and the walk ran in insertion order, which
  // is grouped by topic — and TOPIC_DEFAULTS routes BOTH 'Economics'
  // and 'Math & Statistics' to Hamilton, neither being era-routable.
  // The feed ran Hamilton until those topics were exhausted.
  //
  // Widening it to a pool of 40 did NOT fix it: the bank holds ~1,205
  // rows across 9 topics, so a topic block averages over a hundred rows
  // and a 40-row window usually sits entirely inside one. Tested, and
  // it still produced runs of four.
  //
  // Asking each topic for its own oldest row makes the selection
  // independent of how the bank is ordered on disk. Nine small queries,
  // one per topic, and the curriculum still advances oldest-first
  // because the candidates are sorted by age before the choice.
  // The faculty never narrates situational-judgment material — see
  // NON_FACULTY_TOPICS. Filtering the topic list is the quarantine: a
  // scenario row cannot be selected here at all, so it cannot reach the
  // router and be handed to whoever the fallback happens to name.
  const facultyTopics = BANK_TOPICS.filter(isFacultyTopic);

  const candidates = (await Promise.all(
    facultyTopics.map((t) =>
      fetch(
        `${SUPABASE_URL}/rest/v1/fsot_questions` +
          `?select=id,topic,subtopic,prompt,options,answer,explanation,last_posted_at` +
          `&topic=eq.${encodeURIComponent(t)}` +
          `&order=last_posted_at.asc.nullsfirst&limit=1`,
        { headers: HEADERS },
      )
        .then((r) => r.json())
        .then((a) => (Array.isArray(a) ? a[0] ?? null : null))
        .catch(() => null),
    ),
  )).filter(Boolean) as any[];

  if (candidates.length === 0) {
    return new Response('Bank is empty — run bank.sql into fsot_questions.', { status: 200 });
  }

  // Oldest first, nulls (never taught) ahead of everything.
  candidates.sort((a, b) => {
    const ta = a.last_posted_at ? Date.parse(a.last_posted_at) : -Infinity;
    const tb = b.last_posted_at ? Date.parse(b.last_posted_at) : -Infinity;
    return ta - tb;
  });

  // 2. Whose record is it? Prefer the oldest candidate whose figure has
  // not just spoken; fall back to the oldest outright so the curriculum
  // never stalls waiting for variety.
  const { handles: recent, topics: recentTopics } = await recentContext();

  // Preference order, strongest first. `recent` is passed into
  // routeFigure so the topic fallback ALSO steps around a voice that
  // just spoke — otherwise the selector rotates topics while the router
  // hands several of them straight back to the same name.
  const rank = (c: any): number => {
    const f = routeFigure(c, recent);
    const freshTopic = !recentTopics.has(c.topic);
    const freshVoice = !recent.has(f.handle);
    if (freshTopic && freshVoice) return 0;
    if (freshTopic) return 1;
    if (freshVoice) return 2;
    return 3;
  };

  let row = candidates[0];
  let best = 4;
  for (const cand of candidates) {
    const r = rank(cand);
    if (r < best) { best = r; row = cand; if (r === 0) break; }
  }
  const figure = routeFigure(row, recent);

  // 3. The figure's account.
  const authorId = await findOrCreateFigureBot(figure);
  if (!authorId) {
    return new Response(`No bot account for ${figure.name}.`, { status: 500 });
  }

  // 4. The words, under the rules.
  const body = await writePost(figure, row);
  if (!body) {
    return new Response('Generation failed; nothing posted.', { status: 200 });
  }

  // 5. Post it. Attribution rides the slugline.
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify({
      author_id: authorId,
      body,
      slugline: `— ${figure.name} · ${row.topic}`,
      visibility: 'public',
      kind: 'post',
    }),
  });
  if (!postRes.ok) {
    return new Response(`post insert failed: ${await postRes.text()}`, { status: 500 });
  }
  const postRow = (await postRes.json())?.[0];

  // 6. Stamp the ledger (097). Service role passes RLS by design.
  await fetch(`${SUPABASE_URL}/rest/v1/fsot_questions?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ last_posted_at: new Date().toISOString(), posted_post_id: postRow?.id }),
  });

  return new Response(
    JSON.stringify({ figure: figure.name, handle: figure.handle, question: row.id, post_id: postRow?.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = {
  // Eight a day across the Eastern waking day (12:00-02:00 UTC is
  // 8am-10pm ET). Was three at 9/14/19 UTC — 5am, 10am and 3pm Eastern,
  // so two of the three landed before the audience was up, which is
  // most of why the feed read as infrequent.
  schedule: '0 12,14,16,18,20,22,0,2 * * *',
};
