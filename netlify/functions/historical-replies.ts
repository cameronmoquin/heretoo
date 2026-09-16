/**
 * Scheduled function — the figures answer their students.
 *
 * Every half hour, find fresh human comments on the faculty's posts and
 * have the POST'S OWN FIGURE answer each one, threaded under the
 * comment, in first person, under the voice rules — with the bank rows
 * nearest the post's topic as the only source material. A question the
 * bank cannot answer gets the honest version: this is beyond the record
 * in front of me, and here is what the record does hold.
 *
 * Bounded and deduplicated:
 *   - only top-level human comments on figure posts, from the last 48h,
 *   - each comment answered exactly once (fsot_replies ledger, 097),
 *   - figures never answer figures — no bot-to-bot cascade, ever,
 *   - at most REPLIES_PER_RUN per wake.
 *
 * Fail-soft: dormant without ANTHROPIC_API_KEY; any per-comment failure
 * skips that comment and leaves it for a future run.
 */

import type { Config } from '@netlify/functions';
import { VOICE_RULES, FIGURES, figureByHandle } from '../../lib/historical-figures';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const HEADERS = {
  apikey: SERVICE_ROLE,
  Authorization: `Bearer ${SERVICE_ROLE}`,
  'Content-Type': 'application/json',
};

const REPLIES_PER_RUN = 5;
const LOOKBACK_HOURS = 48;
const CONTEXT_ROWS = 6;

async function rest(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }
  if (!ANTHROPIC_KEY) {
    return new Response('Dormant: no ANTHROPIC_API_KEY.', { status: 200 });
  }

  // 1. The faculty's profile ids, keyed for both directions.
  const handles = FIGURES.map((f) => f.handle).join(',');
  const profs = await rest(`profiles?handle=in.(${handles})&select=id,handle`);
  if (!Array.isArray(profs) || profs.length === 0) {
    return new Response('No faculty accounts yet — the first drip creates them.', { status: 200 });
  }
  const idToHandle = new Map<string, string>(profs.map((p: any) => [p.id, p.handle]));
  const botIds = [...idToHandle.keys()];

  // 2. Their recent posts, then fresh top-level human comments on them.
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600e3).toISOString();
  const posts = await rest(
    `posts?author_id=in.(${botIds.join(',')})&select=id,author_id,body,slugline&order=created_at.desc&limit=40`,
  );
  if (!Array.isArray(posts) || posts.length === 0) {
    return new Response('No faculty posts yet.', { status: 200 });
  }
  const postById = new Map<string, any>(posts.map((p: any) => [p.id, p]));

  const comments = await rest(
    `comments?post_id=in.(${posts.map((p: any) => p.id).join(',')})` +
      `&parent_comment_id=is.null&created_at=gte.${since}` +
      `&select=id,post_id,author_id,body&order=created_at.asc&limit=100`,
  );
  const candidates = (Array.isArray(comments) ? comments : [])
    .filter((c: any) => !idToHandle.has(c.author_id)); // figures never answer figures
  if (candidates.length === 0) {
    return new Response('Nothing to answer.', { status: 200 });
  }

  // 3. Drop the already-answered (ledger, 097).
  const answered = await rest(
    `fsot_replies?comment_id=in.(${candidates.map((c: any) => c.id).join(',')})&select=comment_id`,
  );
  const done = new Set((Array.isArray(answered) ? answered : []).map((r: any) => r.comment_id));
  const queue = candidates.filter((c: any) => !done.has(c.id)).slice(0, REPLIES_PER_RUN);

  let sent = 0;
  for (const c of queue) {
    try {
      const post = postById.get(c.post_id);
      const handle = idToHandle.get(post.author_id)!;
      const figure = figureByHandle(handle);
      if (!figure) continue;

      // 4. Source material: the bank rows nearest this post's topic.
      // The slugline carries "— Name · Topic"; fall back to the whole
      // bank's least-taught rows when parsing misses.
      const topic = (post.slugline ?? '').split('·')[1]?.trim();
      const bank = await rest(
        `fsot_questions?select=prompt,options,answer,explanation,topic,subtopic` +
          (topic ? `&topic=eq.${encodeURIComponent(topic)}` : '') +
          `&limit=${CONTEXT_ROWS}`,
      );
      const source = (Array.isArray(bank) ? bank : []).map((r: any, i: number) => {
        const opts = Array.isArray(r.options) ? r.options : [];
        const ans = typeof r.answer === 'number' ? opts[r.answer] : null;
        return `[${i + 1}] ${r.prompt}${ans ? ` — ${ans}.` : ''}${r.explanation ? ` ${r.explanation}` : ''}`;
      }).join('\n');

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 350,
          temperature: 0.7,
          system: `${VOICE_RULES}\n\nYOU ARE: ${figure.name} (${figure.years}). ${figure.dossier}`,
          messages: [{
            role: 'user',
            content:
              `Your post read:\n"${post.body}"\n\nA reader replied:\n"${String(c.body).slice(0, 800)}"\n\n` +
              `SOURCE MATERIAL (the only record you may draw facts from):\n${source || '(the record at hand is empty)'}\n\n` +
              `Answer the reader in your own voice. Reply with the comment body only.`,
          }],
        }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('[historical-replies] model error', res.status, await res.text());
        continue;
      }
      const j = await res.json();
      const text: string | undefined = j?.content?.[0]?.text;
      if (!text || text.trim().length < 5 || text.length > 1800) continue;

      // 5. Thread the answer under the reader's comment.
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({
          post_id: c.post_id,
          author_id: post.author_id,
          parent_comment_id: c.id,
          body: text.trim(),
        }),
      });
      if (!ins.ok) {
        // eslint-disable-next-line no-console
        console.error('[historical-replies] comment insert failed', await ins.text());
        continue;
      }

      // 6. Ledger — even before knowing the comment id; the answer
      // exists, so this question is closed.
      await fetch(`${SUPABASE_URL}/rest/v1/fsot_replies`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify({ comment_id: c.id, post_id: c.post_id, figure: figure.handle }),
      });
      sent += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[historical-replies] skipped one:', e);
    }
  }

  return new Response(JSON.stringify({ answered: sent, considered: queue.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  schedule: '*/30 * * * *',
};
