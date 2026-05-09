/**
 * Conflict Reframer endpoint (Source of Truth, Milestone 8).
 *
 * The user is composing a message that we (client-side) flagged as
 * escalating. They tapped the eye icon. This function calls Claude to
 * produce three calm paragraphs: reading the other person's note,
 * reading the user's draft, and an optional alternative phrasing.
 *
 * Inputs:
 *   - draft: the message the user is about to send
 *   - context: up to 3 immediately-preceding messages (NOT the full
 *     conversation history). Each is { from: 'me'|'them', body }.
 *
 * Server-side, NOTHING is stored. The function is a pure relay to
 * Claude. The DB never sees the draft or the reframe — only the
 * client-stored reframer_events row carries metadata.
 *
 * Refusal list (M8):
 *   - No automatic edits. The function returns suggested prose; the
 *     client decides whether to copy/edit/ignore.
 *   - No log of content. Logs only contain non-content debug strings.
 */

import type { Config } from '@netlify/functions';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

interface Body {
  draft?: string;
  context?: Array<{ from: 'me' | 'them'; body: string }>;
  surface?: 'dm' | 'family_chat';
}

const SYSTEM_PROMPT = `You are a thoughtful relative passing through a family chat. The user (a real human, signed in) is composing a message that may land harder than they intend, in a back-and-forth that may be drifting toward conflict.

Write a single response with EXACTLY three short paragraphs, separated by blank lines. Use plain prose — no bullet points, no headings, no bold or italics, no emoji. Source Serif tone: calm, warm, grown-up.

Paragraph 1 — "Reading their note." If there is preceding context, name what the other person likely meant or felt. If there is no preceding context, gently note the absence and skip to the user's draft. One to two sentences.

Paragraph 2 — "Reading your draft." Note how the draft might land in tone, regardless of intent. Acknowledge what the user may have meant. One to two sentences.

Paragraph 3 — A single suggested alternative draft, in the user's voice. Same content, gentler register. One short paragraph. Do not introduce it ("here is an alternative" etc.); just write it.

Rules:
- Never moralize. Never say "you should." The user is the author of the final message.
- Never suggest the user is wrong. Both sides may be misreading each other.
- Never write more than three paragraphs.
- Never use exclamation marks.
- Never refer to yourself as an AI, model, or assistant. You are a thoughtful presence.`;

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: 'Reframer not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }

  const draft = (body.draft ?? '').trim();
  if (!draft || draft.length < 10) {
    return new Response(
      JSON.stringify({ error: 'No draft provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (draft.length > 4000) {
    return new Response(
      JSON.stringify({ error: 'Draft too long for reframer' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const context = (body.context ?? []).slice(-3);
  let userMessage = '';
  if (context.length > 0) {
    userMessage += 'Recent messages, oldest first:\n';
    for (const m of context) {
      const who = m.from === 'me' ? 'You' : 'Them';
      const trimmed = (m.body ?? '').slice(0, 800);
      userMessage += `${who}: ${trimmed}\n`;
    }
    userMessage += '\n';
  }
  userMessage += `Your draft:\n${draft}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    // eslint-disable-next-line no-console
    console.error('[reframer] anthropic non-ok', res.status, errText.slice(0, 200));
    return new Response(
      JSON.stringify({ error: 'Reframer service error' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const json = (await res.json()) as any;
  const text: string = json?.content?.[0]?.text ?? '';

  // Split on double-newline; expect three paragraphs.
  const paragraphs = text.split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean);
  return new Response(
    JSON.stringify({
      readingTheirs: paragraphs[0] ?? '',
      readingYours: paragraphs[1] ?? '',
      alternative: paragraphs[2] ?? '',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = { path: '/api/reframer' };
