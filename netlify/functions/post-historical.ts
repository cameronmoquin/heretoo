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
import { VOICE_RULES, routeFigure, type Figure } from '../../lib/historical-figures';

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

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }
  if (!ANTHROPIC_KEY) {
    return new Response('Dormant: no ANTHROPIC_API_KEY.', { status: 200 });
  }

  // 1. The least-recently-taught fact. Nulls first walks the whole
  // curriculum before anything repeats.
  const bankRes = await fetch(
    `${SUPABASE_URL}/rest/v1/fsot_questions` +
      `?select=id,topic,subtopic,prompt,options,answer,explanation` +
      `&order=last_posted_at.asc.nullsfirst&limit=1`,
    { headers: HEADERS },
  );
  const rows = await bankRes.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    return new Response('Bank is empty — run bank.sql into fsot_questions.', { status: 200 });
  }

  // 2. Whose record is it?
  const figure = routeFigure(row);

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
  schedule: '0 9,14,19 * * *',
};
