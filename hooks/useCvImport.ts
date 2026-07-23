/**
 * useCvImport — turn a resume into memoir timeline events.
 *
 * The user is seeding the memoir timeline. They paste (or upload) a
 * resume. useParseCv POSTs the plain text to /api/parse-cv, which asks
 * Claude for a strict list of schools and jobs with fuzzy dates. The
 * function ONLY extracts. Nothing is written yet.
 *
 * This hook maps the function's { start_year, start_month, ... } shape
 * onto the timeline's { start_date, start_precision, ... } shape so the
 * confirm UI and useBulkCreateTimelineEvents (in hooks/useMemoirTimeline,
 * owned separately) can consume the result directly and spread it into
 * an insert. Year only becomes precision 'year'. Year and month becomes
 * precision 'month'. The CV never carries a day.
 *
 * The screen is responsible for turning an uploaded file into text
 * before it calls. The simplest path ships now: accept a pasted string.
 * PDF and DOCX text extraction is a thin follow-up the screen can add
 * (a web text-extraction step) without touching this hook.
 *
 * Fail-soft. The endpoint always answers 200. On its { error } field we
 * throw a readable message so React Query surfaces it and the confirm UI
 * stays out of a crashed state.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── The endpoint's own shape ────────────────────────────────────────

export interface CvEventRaw {
  kind: 'school' | 'job';
  title: string;
  organization: string | null;
  role_or_grade: string | null;
  location: string | null;
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_ongoing: boolean;
}

interface ParseCvResponse {
  events?: CvEventRaw[];
  error?: string;
}

// ── The timeline shape the confirm UI and bulk-insert consume ───────
// Aligned to public.memoir_timeline_events columns. project_id and
// author_id are added by the insert layer, not here. source is stamped
// 'cv_import' so the row records where it came from.

export type TimelinePrecision = 'year' | 'month' | 'day';

export interface ParsedTimelineEvent {
  kind: 'school' | 'job';
  title: string;
  organization: string | null;
  role_or_grade: string | null;
  location: string | null;
  start_date: string | null;      // 'YYYY-MM-DD', anchored to the first of the known unit
  start_precision: TimelinePrecision;
  end_date: string | null;
  end_precision: TimelinePrecision | null;
  is_ongoing: boolean;
  source: 'cv_import';
}

// ── Year/month → anchored date + precision ──────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** A fuzzy date. A year alone anchors to Jan 1 and reads as 'year'. A
 *  year and month anchor to the first of the month and read as 'month'.
 *  The stored date sorts right; the precision governs how it renders. */
function toAnchoredDate(
  year: number | null,
  month: number | null,
): { date: string | null; precision: TimelinePrecision | null } {
  if (!year) return { date: null, precision: null };
  if (month) return { date: `${year}-${pad2(month)}-01`, precision: 'month' };
  return { date: `${year}-01-01`, precision: 'year' };
}

function mapEvent(e: CvEventRaw): ParsedTimelineEvent {
  const start = toAnchoredDate(e.start_year, e.start_month);
  const end = e.is_ongoing
    ? { date: null, precision: null }
    : toAnchoredDate(e.end_year, e.end_month);

  return {
    kind: e.kind,
    title: e.title,
    organization: e.organization,
    role_or_grade: e.role_or_grade,
    location: e.location,
    // A CV event with no year is legal. It lands as an undated event the
    // author places by hand. Default its precision to 'year'.
    start_date: start.date,
    start_precision: start.precision ?? 'year',
    end_date: end.date,
    end_precision: end.precision,
    is_ongoing: e.is_ongoing,
    source: 'cv_import',
  };
}

/**
 * Parse already-extracted resume text into timeline-ready events.
 * The screen extracts text from a PDF/DOCX or takes a paste, then calls
 * mutate({ text }). Nothing persists here. The confirm step owns the write.
 */
export function useParseCv() {
  return useMutation({
    mutationFn: async (input: { text: string }): Promise<ParsedTimelineEvent[]> => {
      const text = (input.text ?? '').trim();
      if (!text) throw new Error('Paste your resume text first.');

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/parse-cv', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });

      // The endpoint is fail-soft and answers 200 with { events, error }.
      const j = (await res.json()) as ParseCvResponse;
      if (j.error) throw new Error(j.error);

      const events = Array.isArray(j.events) ? j.events : [];
      return events.map(mapEvent);
    },
  });
}
