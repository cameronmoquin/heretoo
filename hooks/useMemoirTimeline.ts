/**
 * useMemoirTimeline. The chronological spine of the memoir (migration 061).
 *
 * Life events on a dated axis. Schools, jobs, homes, milestones, trips,
 * births. Each event gathers the answers written from it and the photos
 * taken during it. Dates are fuzzy on purpose. A school year is not a
 * day, so every event stores a real date plus the precision the author
 * actually knows, and the card renders "2003", "Sept 2003", or
 * "Sept 4, 2003" while still sorting right.
 *
 * FAIL SOFT. Migration 061 is handed to the owner to run by hand, so the
 * deploy lands first. Until it runs, memoir_timeline_events does not
 * exist and timeline_event_id / captured_at / captured_precision are not
 * columns on memoir_responses or memoir_assets. Every read here swallows
 * the error, warns once, and returns an empty list, so the memoir room
 * renders instead of crashing. Writes surface a real error and roll their
 * optimistic row back. This mirrors hooks/useLineReactions.ts.
 *
 * The project id comes from useEnsureMemoirProject in hooks/useMemoir.ts.
 * author_id is the signed-in user. RLS scopes every row to that author.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import {
  useEnsureMemoirProject,
  type MemoirResponse,
  type MemoirAsset,
} from './useMemoir';

// ── Types ──────────────────────────────────────────────────────────

export type DatePrecision = 'year' | 'month' | 'day';

export type TimelineKind =
  | 'school'
  | 'job'
  | 'residence'
  | 'milestone'
  | 'relationship'
  | 'travel'
  | 'baby'
  | 'custom';

export type TimelineSource = 'manual' | 'cv_import' | 'baby_book';

/** One row of public.memoir_timeline_events. */
export interface TimelineEvent {
  id: string;
  project_id: string;
  author_id: string;
  kind: TimelineKind;
  title: string;
  organization: string | null;
  role_or_grade: string | null;
  location: string | null;
  /** ISO date (YYYY-MM-DD) or null for an undated event. */
  start_date: string | null;
  start_precision: DatePrecision;
  end_date: string | null;
  end_precision: DatePrecision | null;
  is_ongoing: boolean;
  notes: string | null;
  source: TimelineSource;
  ordering: number;
  created_at: string;
  updated_at: string;
}

/** The fields a caller supplies to create an event. kind and title are
 *  required; everything else takes a DB default. project_id and
 *  author_id are filled in by the hook, never by the caller. */
export interface NewTimelineEvent {
  kind: TimelineKind;
  title: string;
  organization?: string | null;
  role_or_grade?: string | null;
  location?: string | null;
  start_date?: string | null;
  start_precision?: DatePrecision;
  end_date?: string | null;
  end_precision?: DatePrecision | null;
  is_ongoing?: boolean;
  notes?: string | null;
  source?: TimelineSource;
  ordering?: number;
}

export type TimelineEventPatch = Partial<Omit<
  TimelineEvent,
  'id' | 'project_id' | 'author_id' | 'created_at' | 'updated_at'
>>;

export interface AssetTimelinePatch {
  captured_at?: string | null;
  captured_precision?: DatePrecision | null;
  timeline_event_id?: string | null;
}

// ── Fail-soft warning (once) ───────────────────────────────────────

let warned = false;
function warnOnce(e: any) {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn('[memoir-timeline] unavailable; migration 061 may not have run', e?.message ?? e);
}

// ── Date rendering ─────────────────────────────────────────────────

// September is "Sept". Everything else is a clean three letters.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/**
 * Render a fuzzy date at the precision the author knows.
 *   'year'  -> "2003"
 *   'month' -> "Sept 2003"
 *   'day'   -> "Sept 4, 2003"
 * Parses the YYYY-MM-DD string by hand so no timezone shifts the day.
 * Returns '' for a null or unparseable date.
 */
export function formatFuzzyDate(
  date: string | null | undefined,
  precision: DatePrecision | null | undefined,
): string {
  if (!date) return '';
  const [y, m, d] = date.slice(0, 10).split('-').map((n) => parseInt(n, 10));
  if (!y || Number.isNaN(y)) return '';
  const p = precision ?? 'year';
  if (p === 'year') return String(y);
  const mon = MONTHS[(m || 1) - 1] ?? '';
  if (p === 'month') return `${mon} ${y}`;
  if (!d || Number.isNaN(d)) return `${mon} ${y}`;
  return `${mon} ${d}, ${y}`;
}

/**
 * The date line for an event card. A single point, a range, or an open
 * run. Ongoing events read as "start – present". Undated events return
 * ''. The separator is an en dash, the correct glyph for a span.
 */
export function formatRange(event: TimelineEvent): string {
  const start = formatFuzzyDate(event.start_date, event.start_precision);
  if (!start) return '';
  if (event.is_ongoing) return `${start} – present`;
  const end = formatFuzzyDate(event.end_date, event.end_precision);
  if (!end || end === start) return start;
  return `${start} – ${end}`;
}

// ── Optimistic row plumbing ────────────────────────────────────────

let optimisticSeq = 0;
function tempId(): string {
  optimisticSeq += 1;
  return `optimistic-tl-${optimisticSeq}-${Date.now()}`;
}

/** Normalize caller input to a full column set with the DB defaults
 *  applied. Shared by insert and the optimistic row so the two match. */
function normalizeInput(input: NewTimelineEvent) {
  return {
    kind: input.kind,
    title: input.title,
    organization: input.organization ?? null,
    role_or_grade: input.role_or_grade ?? null,
    location: input.location ?? null,
    start_date: input.start_date ?? null,
    start_precision: input.start_precision ?? 'year',
    end_date: input.end_date ?? null,
    end_precision: input.end_precision ?? null,
    is_ongoing: input.is_ongoing ?? false,
    notes: input.notes ?? null,
    source: input.source ?? 'manual',
    ordering: input.ordering ?? 0,
  } as const;
}

function optimisticEvent(input: NewTimelineEvent, authorId: string, projectId: string): TimelineEvent {
  const now = new Date().toISOString();
  return {
    id: tempId(),
    project_id: projectId,
    author_id: authorId,
    ...normalizeInput(input),
    created_at: now,
    updated_at: now,
  };
}

// ── Queries ────────────────────────────────────────────────────────

/**
 * Every event on a project's spine, oldest first. start_date leads,
 * ordering breaks ties, and undated events fall to the end (nullsFirst:
 * false). Returns [] and warns once if the table is not there yet.
 */
export function useTimelineEvents(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-timeline', projectId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('memoir_timeline_events')
        .select('*')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true, nullsFirst: false })
        .order('ordering', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as TimelineEvent[];
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/**
 * The answers written from one event. memoir_responses filtered by
 * timeline_event_id. Empty and warned once until the column lands.
 */
export function useEventResponses(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-event-responses', eventId],
    queryFn: async (): Promise<MemoirResponse[]> => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('memoir_responses')
        .select(`
          *,
          prompt:memoir_prompts!prompt_id(
            id, slug, category, chapter_or_thread, primary_question,
            follow_ups, tags, difficulty, triggers_warning
          )
        `)
        .eq('timeline_event_id', eventId)
        .order('ordering_hint', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as MemoirResponse[];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/**
 * The photos dated into one event. memoir_assets filtered by
 * timeline_event_id. Empty and warned once until the column lands.
 */
export function usePhotosForEvent(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-event-photos', eventId],
    queryFn: async (): Promise<MemoirAsset[]> => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('memoir_assets')
        .select('*')
        .eq('timeline_event_id', eventId)
        .order('captured_at', { ascending: true, nullsFirst: false })
        .order('uploaded_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as MemoirAsset[];
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

/**
 * Insert one event. author_id is the signed-in user, project_id comes
 * from the ensure RPC. Optimistic like useSaveJournalEntry: the row is
 * prepended the instant the user commits, rolled back on error, and
 * swapped for the server row on success. A settle invalidation then
 * reconciles chronological order.
 */
export function useCreateTimelineEvent() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: projectId } = useEnsureMemoirProject();
  const key = ['memoir-timeline', projectId] as const;

  return useMutation({
    mutationFn: async (input: NewTimelineEvent): Promise<TimelineEvent> => {
      if (!userId) throw new Error('Sign in first.');
      if (!projectId) throw new Error('No memoir project.');
      const { data, error } = await supabase
        .from('memoir_timeline_events')
        .insert({
          ...normalizeInput(input),
          project_id: projectId,
          author_id: userId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as TimelineEvent;
    },
    onMutate: async (input) => {
      if (!userId || !projectId) return { snapshot: undefined, tempId: null };
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<TimelineEvent[]>(key);
      const row = optimisticEvent(input, userId, projectId);
      qc.setQueryData<TimelineEvent[]>(key, (prev) => [row, ...(prev ?? [])]);
      return { snapshot, tempId: row.id };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (serverRow, _input, ctx) => {
      qc.setQueryData<TimelineEvent[]>(key, (prev) =>
        (prev ?? []).map((e) => (e.id === ctx?.tempId ? serverRow : e)));
    },
    onSettled: () => {
      // Reconcile the spine's sort once the insert is confirmed.
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Insert an array of events in one call. For the CV-import confirm step,
 * where the author reviews a parsed batch and commits it whole. Not
 * optimistic; the confirm screen shows a spinner and reloads the spine.
 */
export function useBulkCreateTimelineEvents() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: projectId } = useEnsureMemoirProject();

  return useMutation({
    mutationFn: async (events: NewTimelineEvent[]): Promise<TimelineEvent[]> => {
      if (!userId) throw new Error('Sign in first.');
      if (!projectId) throw new Error('No memoir project.');
      if (events.length === 0) return [];
      const rows = events.map((e) => ({
        ...normalizeInput(e),
        project_id: projectId,
        author_id: userId,
      }));
      const { data, error } = await supabase
        .from('memoir_timeline_events')
        .insert(rows as any)
        .select();
      if (error) throw error;
      return (data ?? []) as TimelineEvent[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memoir-timeline', projectId] });
    },
  });
}

/** Patch an event by id: title, dates, precision, notes, ordering, any
 *  column. projectId keys the cache invalidation. */
export function useUpdateTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string; patch: TimelineEventPatch }) => {
      const { error } = await supabase
        .from('memoir_timeline_events')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-timeline', vars.projectId] });
    },
  });
}

/** Delete an event by id. The event's responses and photos survive; the
 *  DB clears their timeline_event_id (on delete set null). */
export function useDeleteTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('memoir_timeline_events')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-timeline', vars.projectId] });
      // The event's assets and responses just lost their link.
      qc.invalidateQueries({ queryKey: ['memoir-event-photos', vars.id] });
      qc.invalidateQueries({ queryKey: ['memoir-event-responses', vars.id] });
      qc.invalidateQueries({ queryKey: ['memoir-assets', vars.projectId] });
    },
  });
}

/**
 * Date a photo and pin it to the timeline. Patches captured_at,
 * captured_precision, and timeline_event_id on one memoir_asset.
 * Invalidates the project's asset list and any event's photo strip.
 */
export function useSetAssetTimeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string; patch: AssetTimelinePatch }) => {
      const { error } = await supabase
        .from('memoir_assets')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-assets', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['memoir-event-photos'] });
    },
  });
}

// ── Timeline prompts (kind-scoped) ─────────────────────────────────
// Each event kind maps to a memoir_prompts category seeded by migration
// 062. Those rows carry a null slug on purpose, so pick_next_memoir_prompt
// never returns them. The timeline asks for them by category instead.
// Without this the "answer a prompt" flow falls back to generic
// life_chapter questions and every seeded timeline prompt is dead data.

const KIND_TO_PROMPT_CATEGORY: Record<string, string> = {
  school: 'timeline_school',
  job: 'timeline_job',
  baby: 'timeline_baby',
  milestone: 'timeline_milestone',
  residence: 'timeline_milestone',
  relationship: 'timeline_milestone',
  travel: 'timeline_milestone',
  custom: 'timeline_milestone',
};

/** The memoir_prompts category a given event kind draws its questions from. */
export function timelineCategoryForKind(kind: string | null | undefined): string {
  return (kind && KIND_TO_PROMPT_CATEGORY[kind]) || 'timeline_milestone';
}

export interface TimelinePrompt {
  id: string;
  primary_question: string;
  category: string;
  position: number;
}

/** Every timeline prompt for an event kind, in position order. Fails soft
 *  to an empty list before migration 062 has run. The screen picks the
 *  first one this event has not answered yet. */
export function useTimelinePrompts(kind: string | null | undefined) {
  const category = kind ? timelineCategoryForKind(kind) : null;
  return useQuery({
    queryKey: ['memoir-timeline-prompts', category],
    enabled: !!category,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TimelinePrompt[]> => {
      if (!category) return [];
      try {
        const { data, error } = await supabase
          .from('memoir_prompts')
          .select('id, primary_question, category, position')
          .eq('category', category)
          .is('slug', null)
          .eq('retired', false)
          .order('position', { ascending: true });
        if (error) throw error;
        return (data ?? []) as TimelinePrompt[];
      } catch (e) {
        warnOnce(e);
        return [];
      }
    },
  });
}
