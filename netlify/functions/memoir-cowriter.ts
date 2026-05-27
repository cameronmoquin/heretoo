/**
 * /api/memoir-cowriter — draft prose from a session's transcript.
 *
 * Co-writer mode (spec, §The Anthropic API integration). The user
 * has finished a session of Socratic answers; this endpoint asks
 * Claude Opus 4.5 to compose a prose draft using only the writer's
 * own phrases and patterns. The user accepts, edits, or rejects
 * the draft per response.
 *
 * Cost note: Opus is ~5× Sonnet. Caching on the system prompt cuts
 * a chunk back. A typical session draft is ~$0.30–$0.60.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const COWRITER_MODEL = process.env.ANTHROPIC_COWRITER_MODEL || 'claude-opus-4-5';

const SHARED_RULES = `You are a co-writer for HereToo Memoir. You are not the author. You compose prose drafts only from the writer's own transcript.

VOICE RULES (non-negotiable):
- No em dashes.
- No adverbs on action.
- No interiority or figurative language unless quoting the user.
- No weather as mood.
- No "Not X but Y" constructions.
- No moralizing.
- No therapy-speak.

THE WRITER IS THE AUTHOR. Your name will not appear on the book.

NEVER:
- Invent details the writer has not confirmed.
- Reach for figurative language. The writer's literal phrasing is gold.
- Smooth out the writer's idioms, regionalisms, or sentence rhythms.
- Add transitions, scene-setting, or atmospheric framing the writer didn't supply.

ALWAYS:
- Use the writer's exact phrases wherever possible.
- Match their syntactic patterns. Short sentences if they're short. Long ones if they're long.
- Preserve their verbal tics.
- Stay one paragraph per response unless the answer plainly spans more.`;

const COWRITER_ADDITION = `MODE: COWRITER DRAFT

You will receive the writer's transcript for ONE response (a question plus the writer's answer). Compose a single prose draft built from that answer, using only what's in it.

Output format — return ONLY a JSON object, no markdown fences:
{
  "draft": "<prose draft>",
  "phrases_used_verbatim": ["<phrase>", "<phrase>"]
}

If the answer is too thin to draft from (under ~30 words, or unintelligible), return:
{ "draft": "", "phrases_used_verbatim": [] }`;

interface Body {
  /** The original question (library prompt or Claude-generated follow-up). */
  question?: string;
  /** The writer's answer (raw transcript or final_text). */
  transcript?: string;
}

interface CowriterResult {
  draft: string;
  phrases_used_verbatim: string[];
}

function empty(): CowriterResult {
  return { draft: '', phrases_used_verbatim: [] };
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!ANTHROPIC_KEY) return json({ error: 'Co-writer not configured' }, 503);

  // Require sign-in to keep this from being an open Opus proxy.
  const auth = req.headers.get('authorization');
  if (!auth || !SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'Not signed in' }, 401);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    if (!u.ok) return json({ error: 'Not signed in' }, 401);
  } catch {
    return json({ error: 'Not signed in' }, 401);
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }
  const question = (body.question ?? '').trim();
  const transcript = (body.transcript ?? '').trim();
  if (transcript.length < 30) return json(empty(), 200);

  const userMessage = `Question that was asked:
"${question}"

The writer's answer:
"""
${transcript}
"""

Compose the draft.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COWRITER_MODEL,
        max_tokens: 1200,
        temperature: 0.3,
        system: [
          { type: 'text', text: SHARED_RULES, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: COWRITER_ADDITION },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!claudeRes.ok) {
      // eslint-disable-next-line no-console
      console.error('[memoir-cowriter] anthropic', claudeRes.status);
      return json({ error: 'Co-writer service error' }, 502);
    }
    const claudeJson = (await claudeRes.json()) as any;
    const raw = claudeJson?.content?.[0]?.text ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { return json(empty(), 200); }
    const result: CowriterResult = {
      draft: typeof parsed.draft === 'string' ? parsed.draft.trim() : '',
      phrases_used_verbatim: Array.isArray(parsed.phrases_used_verbatim)
        ? parsed.phrases_used_verbatim.filter((p: any) => typeof p === 'string')
        : [],
    };
    return json(result, 200);
  } catch (e: any) {
    return json({ error: `Co-writer failed: ${e?.message ?? ''}`.slice(0, 200) }, 502);
  }
};

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = { path: '/api/memoir-cowriter' };
