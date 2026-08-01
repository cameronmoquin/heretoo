/**
 * /api/parse-cv — extract structured life events from a document.
 *
 * The user is building the memoir timeline. They upload or paste a
 * document: a resume, a CV, a college transcript, or a report card. We
 * hand Claude the plain text and ask for a strict JSON list of schools
 * and jobs, with fuzzy dates (year, or year and month). Transcripts and
 * report cards come back as 'school' events carrying the institution,
 * the period, the grade or level, and a short factual 'detail' summary
 * of the marks or courses the text lists.
 *
 * The path stays /api/parse-cv. The name is the DB-stable identifier.
 *
 * This endpoint ONLY extracts. It never writes to Supabase. There is no
 * service key here and no database function to grant or revoke. The user
 * reviews and edits every event in a confirm step before anything is
 * saved, so a stray or wrong row cannot reach the database from here.
 *
 * The system message forbids fabrication. Any field not present in the
 * document comes back null. Claude is told never to invent a date, a
 * grade, or an employer the text does not contain.
 *
 * Fail-soft. When ANTHROPIC_API_KEY is missing, or Claude errors, or the
 * reply will not parse, we return { events: [], error: '...' } with a
 * 200 so the client shows a plain message instead of a crash.
 */

import type { Config } from '@netlify/functions';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MEMOIR_MODEL || 'claude-sonnet-4-5';

// Auth. This endpoint spends Anthropic credits, so a signed-in user has
// to be behind every call. Without this gate it is an open Claude relay
// anyone can drain with the public anon key. Mirrors memoir-cowriter.ts.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Confirm the caller is a real signed-in user before doing any work.
 *  Returns true when the bearer token resolves to a user. */
async function isSignedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth || !SUPABASE_URL || !SERVICE_ROLE) return false;
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: SERVICE_ROLE },
    });
    return u.ok;
  } catch {
    return false;
  }
}

const MAX_INPUT = 60_000;

const SYSTEM_RULES = `You extract life events from a document. The document is a resume, a CV, a college transcript, or a report card. You are precise and literal.

HARD RULE: NEVER FABRICATE.
- Use only what the document text states.
- If a field is not in the text, it is null.
- Never invent a date, a year, a month, an employer, a school, an institution, a title, a grade, a GPA, or a location.
- Never round, guess, or fill a gap. A missing end year is null, not the current year.
- If you cannot tell whether an entry is a school or a job, prefer the one the wording supports. If truly unclear, use 'job'.

WHAT COUNTS:
- kind 'school': a degree, a diploma, a certificate, a program, an enrolled course of study, or a term recorded on a transcript or report card. The organization is the school or institution. role_or_grade is the degree, the field of study, or the grade level when stated (for example "Grade 11", "Senior year", "B.A. History").
- kind 'job': a position, a role, an internship, a fellowship, a volunteer post held at an organization. The organization is the employer. role_or_grade is the job title when stated.
- Skip skills lists, summaries, references, and contact blocks. Those are not events.

TRANSCRIPTS AND REPORT CARDS:
- Treat each recorded institution and term as a 'school' event. The organization is the institution. role_or_grade is the grade level or year when the text names it.
- Emit one event per institution or per term as the document presents it. Keep separate terms separate. Keep a whole term whole.
- When the document lists courses, marks, or a GPA, put a short factual summary in 'detail'. Draw it only from the text. A course the text omits stays out. A grade the text omits stays out.

DETAIL:
- 'detail' is an optional short factual summary of the entry, drawn only from the text. A GPA, marks, honors, or listed courses belong here. Keep it to one short line (for example "GPA 3.8; Honors English, AP History"). When the text carries none of this, detail is null.

DATES:
- start_year and end_year are four-digit years taken from the text.
- start_month and end_month are 1 through 12, only when the text names the month. Otherwise null.
- is_ongoing is true only when the text says the entry is current (words like "present", "current", "now"). When is_ongoing is true, end_year and end_month are null.

You return JSON only. No prose. No markdown fences.`;

const OUTPUT_SPEC = `Return a JSON object of this exact shape and nothing else:

{
  "events": [
    {
      "kind": "school" | "job",
      "title": "<short label for the entry, e.g. the degree name, the grade level, or the job title>",
      "organization": "<school, institution, or employer, or null>",
      "role_or_grade": "<degree, field, grade level, or job title, or null>",
      "location": "<city, region, or null>",
      "detail": "<short factual summary from the text: GPA, grades, honors, or courses, or null>",
      "start_year": <number or null>,
      "start_month": <1-12 or null>,
      "end_year": <number or null>,
      "end_month": <1-12 or null>,
      "is_ongoing": <true or false>
    }
  ]
}

title is required for every event. detail is optional and null when the text has nothing to summarize. Order the events as they appear in the document. If the document has no schools or jobs, return { "events": [] }.`;

interface RawEvent {
  kind: unknown;
  title: unknown;
  organization: unknown;
  role_or_grade: unknown;
  location: unknown;
  detail: unknown;
  start_year: unknown;
  start_month: unknown;
  end_year: unknown;
  end_month: unknown;
  is_ongoing: unknown;
}

interface CvEvent {
  kind: 'school' | 'job';
  title: string;
  organization: string | null;
  role_or_grade: string | null;
  location: string | null;
  // A short factual summary drawn only from the text: a GPA, marks,
  // honors, or listed courses on a transcript or report card. Null when
  // the document carries nothing to summarize.
  detail: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_ongoing: boolean;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function softError(error: string): Response {
  return jsonResponse({ events: [], error }, 200);
}

/** A year we will trust. Anything outside this stays null. */
function cleanYear(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < 1900 || n > 2100) return null;
  return n;
}

function cleanMonth(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 12) return null;
  return n;
}

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Coerce one model event into our shape, or drop it. We never add data
 *  the model did not send; we only validate types and clamp ranges. */
function normalize(raw: RawEvent): CvEvent | null {
  const title = cleanText(raw.title);
  if (!title) return null;

  const kind: 'school' | 'job' = raw.kind === 'school' ? 'school' : 'job';
  const isOngoing = raw.is_ongoing === true;

  const startYear = cleanYear(raw.start_year);
  const startMonth = startYear ? cleanMonth(raw.start_month) : null;
  const endYear = isOngoing ? null : cleanYear(raw.end_year);
  const endMonth = endYear ? cleanMonth(raw.end_month) : null;

  return {
    kind,
    title,
    organization: cleanText(raw.organization),
    role_or_grade: cleanText(raw.role_or_grade),
    location: cleanText(raw.location),
    detail: cleanText(raw.detail),
    start_year: startYear,
    start_month: startMonth,
    end_year: endYear,
    end_month: endMonth,
    is_ongoing: isOngoing,
  };
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!(await isSignedIn(req))) {
    return jsonResponse({ events: [], error: 'Sign in to import a document.' }, 401);
  }

  let body: { text?: unknown };
  try { body = await req.json(); } catch { body = {}; }

  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return softError('Paste the document text first.');
  }
  if (text.length > MAX_INPUT) {
    return softError('The document is too long. Trim it and try again.');
  }

  if (!ANTHROPIC_KEY) {
    return softError('Import is offline right now.');
  }

  const userMessage = `Document text:
"""
${text}
"""

Extract the schools and jobs.

${OUTPUT_SPEC}`;

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
        max_tokens: 4000,
        // Extraction, not generation. Zero temperature keeps the model
        // pinned to the text and off invented dates.
        temperature: 0,
        system: [{ type: 'text', text: SYSTEM_RULES }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      // eslint-disable-next-line no-console
      console.error('[parse-cv] anthropic', claudeRes.status, errText.slice(0, 200));
      return softError('Could not read the document. Try again.');
    }

    const claudeJson = (await claudeRes.json()) as any;
    const rawText = claudeJson?.content?.[0]?.text ?? '';
    // Strip any accidental code fence the model produced.
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return softError('Could not read the document. Try again.');
    }

    // Accept either { events: [...] } or a bare [...] array.
    const list: unknown = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.events)
        ? parsed.events
        : null;

    if (!Array.isArray(list)) {
      return softError('Could not read the document. Try again.');
    }

    const events: CvEvent[] = list
      .map((e) => normalize(e as RawEvent))
      .filter((e): e is CvEvent => e !== null);

    return jsonResponse({ events });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[parse-cv] exception', e?.message ?? '');
    return softError('Could not read the document. Try again.');
  }
};

export const config: Config = { path: '/api/parse-cv' };
