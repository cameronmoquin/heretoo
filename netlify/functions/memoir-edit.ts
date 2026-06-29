/**
 * /api/memoir-edit — opt-in spelling + grammar check for memoir text.
 *
 * The user asks; nothing runs automatically. The endpoint sends the
 * draft to Claude with strict instructions: only fix typos and
 * obvious grammar errors; never rewrite voice, register, or
 * sentence structure; return suggestions as a list of {original,
 * suggested, reason} so the user accepts or rejects each one
 * individually.
 *
 * Privacy: the draft text is ephemeral on this endpoint. We log
 * only metadata (text length, suggestion count) to memoir_edit_runs.
 * The text itself never persists server-side.
 *
 * Fail-soft when ANTHROPIC_API_KEY is missing.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a careful, restrained copy editor for personal memoir writing. The author is writing about their own life — their voice is the entire point.

Your job is to find ONLY the following kinds of issues:
1. Genuine typos (misspelled words, doubled words, missing letters).
2. Subject-verb disagreement.
3. Missing or wrong punctuation that obscures meaning.
4. Incorrect homophones (their/there/they're, your/you're, its/it's, etc.).

Your job is NOT:
- Rewriting sentences for flow.
- Replacing vocabulary the author chose.
- Changing tense, voice, or register.
- "Improving" the text in any way.
- Adding or removing content.
- Suggesting structural changes (paragraph breaks, etc.).

If a sentence is unconventional but intelligible, leave it alone.
Older writers often use ellipses, dashes, and run-on sentences
deliberately. Respect that.

Separately, you MAY offer up to 3 brief improvement SUGGESTIONS as plain-language advice the author can choose to act on themselves (for example: "This paragraph jumps years; a date would orient the reader," or "You mention your father here for the first time; a sentence on who he was might help."). These are ideas ONLY. Never rewrite the text to satisfy them. Never include a rewritten version. They exist so the author decides what to implement.

Return your output as a JSON object with this exact shape:

{
  "edits": [
    {
      "original": "<the EXACT original text fragment, character-for-character>",
      "suggested": "<your minimal corrected version>",
      "reason": "<short reason: 'typo', 'subject-verb', 'punctuation', 'homophone'>"
    }
  ],
  "suggestions": [
    "<a short plain-language improvement idea, advice only, no rewritten text>"
  ]
}

If nothing needs correcting, return { "edits": [], "suggestions": [] }. Do not wrap the JSON in markdown fences. Do not explain anything outside the JSON.`;

interface Body {
  text?: string;
  response_id?: string;
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: 'Memoir editor not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }
  const text = (body.text ?? '').trim();
  if (text.length < 10) {
    return new Response(
      JSON.stringify({ edits: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (text.length > 12000) {
    return new Response(
      JSON.stringify({ error: 'Too long for a single check; split into sections.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    // eslint-disable-next-line no-console
    console.error('[memoir-edit] anthropic', claudeRes.status, errText.slice(0, 200));
    return new Response(
      JSON.stringify({ error: 'Editor service error' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const claudeJson = (await claudeRes.json()) as any;
  const raw = claudeJson?.content?.[0]?.text ?? '{"edits":[],"suggestions":[]}';
  let parsed: {
    edits?: Array<{ original: string; suggested: string; reason?: string }>;
    suggestions?: string[];
  };
  try { parsed = JSON.parse(raw); } catch { parsed = { edits: [], suggestions: [] }; }
  const edits = (parsed.edits ?? []).filter(
    (e) => typeof e?.original === 'string' && typeof e?.suggested === 'string',
  );
  const suggestions = (parsed.suggestions ?? [])
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .slice(0, 3);

  // Best-effort metadata audit — content not persisted.
  if (SUPABASE_URL && SERVICE_ROLE) {
    const auth = req.headers.get('authorization');
    let userId: string | null = null;
    if (auth) {
      try {
        const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { Authorization: auth, apikey: SERVICE_ROLE },
        });
        if (u.ok) userId = ((await u.json()) as any)?.id ?? null;
      } catch {}
    }
    if (userId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/memoir_edit_runs`, {
          method: 'POST',
          headers: {
            apikey: SERVICE_ROLE,
            Authorization: `Bearer ${SERVICE_ROLE}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            user_id: userId,
            response_id: body.response_id ?? null,
            text_length: text.length,
            edits_offered: edits.length,
          }),
        });
      } catch {}
    }
  }

  return new Response(
    JSON.stringify({ edits, suggestions }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = { path: '/api/memoir-edit' };
