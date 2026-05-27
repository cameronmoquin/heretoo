/**
 * /api/memoir-interview — Socratic interview turn.
 *
 * Milestone 13. The user just answered a memoir prompt. We hand
 * Claude the shared voice rules, the Socratic mode rules, the
 * prompt's follow-up tree with its condition_hints, and the user's
 * answer. Claude picks the next follow-up (or generates a fresh one
 * if none fit), proposes optional transcript-cleaning fixes, and
 * decides whether the session should wind down.
 *
 * The shared rules block is wrapped in a cache_control marker so
 * repeat calls within a 5-minute window hit Anthropic's prompt
 * cache and avoid the input-token cost on the rules block (~1.2k
 * tokens). The savings are real over a 30-turn session.
 *
 * No PII or text persists on this endpoint. We log only metadata
 * (token usage, fallback rate) to memoir_edit_runs for now.
 *
 * Fail-soft when ANTHROPIC_API_KEY is missing or Claude errors —
 * the UI shows a generic "tell me more about that" follow-up so
 * the session keeps moving.
 */

import type { Config } from '@netlify/functions';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MEMOIR_MODEL || 'claude-sonnet-4-5';

const SHARED_RULES = `You are an interviewer for HereToo Memoir. You are calm, specific, and unhurried.

VOICE RULES (non-negotiable):
- No em dashes.
- No hyphens in compound modifiers.
- No adverbs on action.
- No interiority or figurative language unless quoting the user.
- No weather as mood.
- No "Not X but Y" constructions.
- No "just as" or "the way that" openers.
- No trailing negatives.
- No third sentence repeating the first two.
- No moralizing.
- No therapy-speak. Never say "I'm hearing you say," "How does that make you feel," "That must have been hard," or any variant.
- Specificity over abstraction. Ask what something smelled like, not how it felt.
- Concrete over emotional. Ask what happened next, not what it meant.

THE WRITER IS THE AUTHOR. You are not the author. You are the question-asker.

NEVER:
- Invent details the writer has not confirmed.
- Offer your own opinions on the writer's life.
- Suggest the writer should feel a particular way about anything.
- Refuse a topic the writer wants to address (including hard ones).
- Generate prose.

ALWAYS:
- Keep the writer talking. The interview is for them.
- Choose follow-ups that probe for specific sensory or behavioral detail.
- Honor silences. If the writer says they want to step away from a topic, move on.`;

const SOCRATIC_ADDITION = `GUIDANCE MODE: SOCRATIC

You ask questions. You do not write the book. You do not propose prose. After each user answer, choose the next follow-up from the prompt's follow-up tree (match the condition_hint that best fits what the user actually said), or generate a single new follow-up if none fit. Prefer library follow-ups whenever a hint matches; fall back to generation only as a last resort.

USE THE SESSION CONTEXT. When earlier turns are provided, treat this as one continuous conversation. Never ask something the user already answered. When a detail from an earlier turn connects to what they just said, follow that thread (a name, a place, a person they mentioned before). The writer should feel remembered, not re-interviewed.

Output format — return ONLY a JSON object, no markdown fences, no prose around it:
{
  "next_question": "<the next question to ask, in the writer's idiom>",
  "from_library": true | false,
  "transcript_clean_suggestions": [
    {"original": "<exact substring>", "suggested": "<minimal fix>"}
  ],
  "session_continue": true | false,
  "session_summary": "<one paragraph if session_continue is false, else empty>"
}

session_continue should usually be true. Only set it to false when the user has clearly indicated they want to stop, OR when the conversation has reached a natural warm landing after a long stretch (the caller will tell you how many turns have happened).`;

interface FollowUp {
  question: string;
  condition_hint?: string;
}

interface Body {
  primary_question?: string;
  follow_ups?: FollowUp[];
  user_answer?: string;
  /** How many turns have happened in this session, for pacing hints. */
  turns_so_far?: number;
  /** Optional brief recap of earlier turns in the session. */
  recent_context?: string;
}

interface InterviewResult {
  next_question: string;
  from_library: boolean;
  transcript_clean_suggestions: Array<{ original: string; suggested: string }>;
  session_continue: boolean;
  session_summary: string;
}

function fallback(reason: string): InterviewResult {
  // eslint-disable-next-line no-console
  console.warn('[memoir-interview] fallback:', reason);
  return {
    next_question: 'Tell me more about that.',
    from_library: false,
    transcript_clean_suggestions: [],
    session_continue: true,
    session_summary: '',
  };
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: Body;
  try { body = await req.json(); } catch { body = {}; }
  const userAnswer = (body.user_answer ?? '').trim();
  const primary = (body.primary_question ?? '').trim();
  const followUps = Array.isArray(body.follow_ups) ? body.follow_ups : [];

  if (!primary || userAnswer.length < 2) {
    return new Response(JSON.stringify(fallback('missing input')), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify(fallback('no anthropic key')), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  const turnsSoFar = Math.max(0, Math.min(60, body.turns_so_far ?? 0));
  const recent = (body.recent_context ?? '').slice(0, 2000);

  const userMessage = `Primary question that was just asked:
"${primary}"

Follow-up tree for this prompt (pick the closest match by condition_hint, or generate fresh if none fit):
${JSON.stringify(followUps, null, 2)}

Turns so far in this session: ${turnsSoFar}.

${recent ? `Brief context from earlier in the session:\n${recent}\n\n` : ''}The writer just said:
"""
${userAnswer}
"""

Return the JSON object as specified.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        temperature: 0.4,
        // The rules block is identical across all Socratic calls;
        // cache_control lets Anthropic skip re-tokenising it on
        // repeats within 5 minutes.
        system: [
          { type: 'text', text: SHARED_RULES, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: SOCRATIC_ADDITION },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      // eslint-disable-next-line no-console
      console.error('[memoir-interview] anthropic', claudeRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify(fallback(`anthropic ${claudeRes.status}`)), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const claudeJson = (await claudeRes.json()) as any;
    const raw = claudeJson?.content?.[0]?.text ?? '';
    // Strip any accidental code fence the model produced.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch { return new Response(JSON.stringify(fallback('parse')), { status: 200, headers: { 'Content-Type': 'application/json' } }); }

    const result: InterviewResult = {
      next_question: typeof parsed.next_question === 'string' && parsed.next_question.trim()
        ? parsed.next_question.trim()
        : 'Tell me more about that.',
      from_library: !!parsed.from_library,
      transcript_clean_suggestions: Array.isArray(parsed.transcript_clean_suggestions)
        ? parsed.transcript_clean_suggestions.filter(
            (e: any) => typeof e?.original === 'string' && typeof e?.suggested === 'string',
          )
        : [],
      session_continue: parsed.session_continue !== false,
      session_summary: typeof parsed.session_summary === 'string' ? parsed.session_summary : '',
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify(fallback(`exception ${e?.message ?? ''}`)), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/memoir-interview' };
