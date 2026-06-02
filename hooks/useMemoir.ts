/**
 * useMemoir — Milestone 13 project/session/response model.
 *
 * The Memoir is now a persistent project per author with sessions
 * inside it, prompts pulled from the 390-prompt library, and an
 * interview turn handled by /api/memoir-interview (Socratic mode).
 *
 * Back-compat exports for the older daily-prompt UI are kept where
 * straightforward; the new UI is the canonical surface.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// ── Types ──────────────────────────────────────────────────────────

export interface MemoirPrompt {
  id: string;
  slug: string | null;
  category: string | null;       // 'life_chapter' | 'thematic_thread'
  chapter_or_thread: string | null;
  primary_question: string;
  follow_ups: Array<{ question: string; condition_hint?: string }>;
  tags: string[];
  difficulty: number | null;
  triggers_warning: boolean;
  /** Legacy fields kept for the old daily-prompt screen path. */
  prompt?: string;
  starters?: string[];
}

export interface MemoirProject {
  id: string;
  family_id: string | null;
  author_id: string;
  subject_id: string | null;
  subject_label: string | null;
  title: string;
  dedication: string | null;
  writer_mode: 'self' | 'interviewer' | 'anyone';
  guidance_mode: 'socratic' | 'cowriter' | 'editor';
  output_mode: 'kdp' | 'ingramspark' | 'lulu' | 'private';
  trim_size: string;
  paper_color: string;
  status: 'drafting' | 'editing' | 'print_ready' | 'printed';
  created_at: string;
  updated_at: string;
}

export interface MemoirSession {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  guidance_mode_used: string | null;
  prompt_count: number;
  word_count_added: number;
  summary_paragraph: string | null;
  next_session_hint: string | null;
}

export interface MemoirResponse {
  id: string;
  session_id: string;
  project_id: string;
  prompt_id: string | null;
  custom_prompt_text: string | null;
  transcript: string;
  audio_url: string | null;
  cowriter_draft: string | null;
  user_chose: 'keep_transcript' | 'accept_draft' | 'edit_draft' | 'reject' | null;
  final_text: string;
  asset_ids: string[];
  chapter_assignment: string | null;
  ordering_hint: number | null;
  created_at: string;
  prompt?: MemoirPrompt;
}

export interface MemoirProgress {
  answered_count: number;
  total_count: number;
  word_count: number;
  session_count: number;
}

export interface InterviewTurn {
  next_question: string;
  from_library: boolean;
  transcript_clean_suggestions: Array<{ original: string; suggested: string }>;
  session_continue: boolean;
  session_summary: string;
}

export interface GrammarEdit {
  original: string;
  suggested: string;
  reason?: string;
}

export interface MemoirBookRender {
  id: string;
  project_id: string;
  status: 'pending' | 'rendering' | 'done' | 'failed';
  error: string | null;
  page_count: number | null;
  spine_width_in: number | null;
  interior_pdf_path: string | null;
  cover_pdf_path: string | null;
  epub_path: string | null;
  rendered_at: string;
}

const BOOKS_BUCKET = 'memoir-books';
const ASSETS_BUCKET = 'memoir-assets';

export interface MemoirAsset {
  id: string;
  project_id: string;
  kind: 'photo_digital' | 'photo_scan' | 'document_scan' | 'recorded_audio';
  storage_path: string;
  thumbnail_path: string | null;
  width_px: number | null;
  height_px: number | null;
  caption: string | null;
  date_estimate: string | null;
  people_named: string[];
  place_named: string | null;
  uploaded_at: string;
  /** Which chapter (life_chapter or thematic_thread key) this asset lands
   *  in when the book renders. Reuses chapter_or_thread vocabulary. */
  chapter_assignment?: string | null;
  /** Order within its chapter (lower first); the render worker and the
   *  in-app preview both sort photos by this. */
  ordering_hint?: number | null;
}

// ── Project + session lifecycle ─────────────────────────────────────

/** Ensures the author has exactly one default project; returns its id. */
export function useEnsureMemoirProject() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['memoir-project', userId],
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('ensure_default_memoir_project');
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[memoir] ensure project failed', error.message);
        return null;
      }
      return (data as string) ?? null;
    },
    enabled: !!userId,
    staleTime: 10 * 60_000,
  });
}

export function useMemoirProject(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-project-row', projectId],
    queryFn: async (): Promise<MemoirProject | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('memoir_projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      return (data as MemoirProject) ?? null;
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useUpdateMemoirProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<MemoirProject> }) => {
      const { error } = await supabase
        .from('memoir_projects')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-project-row', vars.id] });
    },
  });
}

/** Start a new session inside a project. Returns the session id. */
export function useStartMemoirSession() {
  return useMutation({
    mutationFn: async (input: { projectId: string; guidanceMode: string }) => {
      const { data, error } = await supabase
        .from('memoir_sessions')
        .insert({
          project_id: input.projectId,
          guidance_mode_used: input.guidanceMode,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
  });
}

export function useEndMemoirSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      summary: string;
      nextHint: string;
    }) => {
      const { error } = await supabase
        .from('memoir_sessions')
        .update({
          ended_at: new Date().toISOString(),
          summary_paragraph: input.summary,
          next_session_hint: input.nextHint,
        } as any)
        .eq('id', input.sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memoir-sessions'] });
    },
  });
}

// ── Prompts ─────────────────────────────────────────────────────────

/** Pick the next prompt to ask in this project. Server-side weighted
 *  toward the chapter the author has been working in. */
export function useNextMemoirPrompt(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-next-prompt', projectId],
    queryFn: async (): Promise<MemoirPrompt | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase.rpc('pick_next_memoir_prompt', {
        p_project_id: projectId,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[memoir] pick next failed', error.message);
        return null;
      }
      const row = ((data ?? []) as any[])[0];
      if (!row) return null;
      return {
        id: row.id,
        slug: row.slug,
        category: row.category,
        chapter_or_thread: row.chapter_or_thread,
        primary_question: row.primary_question,
        follow_ups: Array.isArray(row.follow_ups) ? row.follow_ups : [],
        tags: row.tags ?? [],
        difficulty: row.difficulty,
        triggers_warning: !!row.triggers_warning,
      };
    },
    enabled: !!projectId,
    // The pick is randomised server-side; don't aggressively refetch.
    staleTime: Infinity,
  });
}

/** Legacy: today's prompt for the old daily-prompt screen path. */
export function useTodaysMemoirPrompt() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['memoir-today', userId],
    queryFn: async (): Promise<MemoirPrompt | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('todays_memoir_prompt');
      if (error) return null;
      const row = ((data ?? []) as any[])[0];
      if (!row) return null;
      return {
        id: row.id,
        slug: null,
        category: row.category ?? null,
        chapter_or_thread: null,
        primary_question: row.prompt,
        follow_ups: [],
        tags: [],
        difficulty: null,
        triggers_warning: false,
        prompt: row.prompt,
        starters: (row.starters as string[]) ?? [],
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

// ── Responses ───────────────────────────────────────────────────────

export function useMemoirResponses(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-responses', projectId],
    queryFn: async (): Promise<MemoirResponse[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('memoir_responses')
        .select(`
          *,
          prompt:memoir_prompts!prompt_id(
            id, slug, category, chapter_or_thread, primary_question,
            follow_ups, tags, difficulty, triggers_warning
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemoirResponse[];
    },
    enabled: !!projectId,
  });
}

export function useSaveMemoirResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      projectId: string;
      promptId?: string | null;
      customPromptText?: string | null;
      transcript: string;
      finalText: string;
      audioUrl?: string | null;
      chapterAssignment?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('memoir_responses')
        .insert({
          session_id: input.sessionId,
          project_id: input.projectId,
          prompt_id: input.promptId ?? null,
          custom_prompt_text: input.customPromptText ?? null,
          transcript: input.transcript,
          final_text: input.finalText,
          audio_url: input.audioUrl ?? null,
          user_chose: 'keep_transcript',
          chapter_assignment: input.chapterAssignment ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as MemoirResponse;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-responses', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['memoir-progress', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['memoir-next-prompt', vars.projectId] });
    },
  });
}

/** Patch a response's placement — which chapter it lives in and/or its
 *  order within that chapter. Used by the arrange screen. */
export function useUpdateMemoirResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projectId: string;
      patch: { chapter_assignment?: string | null; ordering_hint?: number | null };
    }) => {
      const { error } = await supabase
        .from('memoir_responses')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-responses', vars.projectId] });
    },
  });
}

/** Renumber a whole chapter: write ordering_hint = index for each id in
 *  the given order, in one pass, then invalidate once. Idempotent —
 *  safe to call on every reorder tap. */
export function useReorderMemoirResponses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; orderedIds: string[] }) => {
      // Small chapters (a handful to a few dozen entries) — parallel
      // single-row updates keep each write inside the row's RLS scope.
      await Promise.all(
        input.orderedIds.map((id, idx) =>
          supabase
            .from('memoir_responses')
            .update({ ordering_hint: idx } as any)
            .eq('id', id),
        ),
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-responses', vars.projectId] });
    },
  });
}

// ── Progress ────────────────────────────────────────────────────────

export function useMemoirProgress(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-progress', projectId],
    queryFn: async (): Promise<MemoirProgress> => {
      if (!projectId) {
        return { answered_count: 0, total_count: 0, word_count: 0, session_count: 0 };
      }
      const { data, error } = await supabase.rpc('memoir_progress_for_project', {
        p_project_id: projectId,
      });
      if (error) {
        return { answered_count: 0, total_count: 0, word_count: 0, session_count: 0 };
      }
      const row = ((data ?? []) as any[])[0];
      return {
        answered_count: row?.answered_count ?? 0,
        total_count: row?.total_count ?? 0,
        word_count: row?.word_count ?? 0,
        session_count: row?.session_count ?? 0,
      };
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

// ── The interview turn — Socratic ───────────────────────────────────

export function useMemoirInterviewTurn() {
  return useMutation({
    mutationFn: async (input: {
      primaryQuestion: string;
      followUps: Array<{ question: string; condition_hint?: string }>;
      userAnswer: string;
      turnsSoFar: number;
      recentContext?: string;
    }): Promise<InterviewTurn> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/memoir-interview', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          primary_question: input.primaryQuestion,
          follow_ups: input.followUps,
          user_answer: input.userAnswer,
          turns_so_far: input.turnsSoFar,
          recent_context: input.recentContext,
        }),
      });
      // The endpoint is fail-soft and always returns 200 with a
      // fallback shape, so we don't need a status check.
      const j = (await res.json()) as InterviewTurn;
      return j;
    },
  });
}

// ── Guidance toggle (kept for back-compat with old UI) ─────────────

export function useMemoirGuidedSetting() {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['memoir-guided', userId],
    queryFn: async (): Promise<boolean> => {
      if (!userId) return true;
      const { data } = await supabase
        .from('profiles')
        .select('memoir_guided')
        .eq('id', userId)
        .maybeSingle();
      return (data as any)?.memoir_guided ?? true;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const set = useMutation({
    mutationFn: async (val: boolean) => {
      if (!userId) return;
      await supabase.from('profiles').update({ memoir_guided: val } as any).eq('id', userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memoir-guided', userId] });
    },
  });

  return { value: query.data ?? true, setValue: (v: boolean) => set.mutate(v) };
}

// ── Photos / assets ─────────────────────────────────────────────────

export function useMemoirAssets(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-assets', projectId],
    queryFn: async (): Promise<MemoirAsset[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('memoir_assets')
        .select('*')
        .eq('project_id', projectId)
        .order('chapter_assignment', { ascending: true, nullsFirst: false })
        .order('ordering_hint', { ascending: true, nullsFirst: false })
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemoirAsset[];
    },
    enabled: !!projectId,
  });
}

/** Upload a photo file to the private assets bucket and insert the
 *  matching memoir_assets row. Returns the created row. */
export function useUploadMemoirAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      file: File;
      caption?: string;
      chapterAssignment?: string | null;
      dateEstimate?: string;
    }): Promise<MemoirAsset> => {
      const ext = (input.file.name.split('.').pop() || 'jpg').toLowerCase();
      // Use a v4-ish id locally so the storage path is stable before
      // the DB insert. The DB row's own id stays gen_random_uuid().
      const localId = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2);
      const path = `${input.projectId}/${localId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(ASSETS_BUCKET)
        .upload(path, input.file, {
          contentType: input.file.type || 'image/jpeg',
          upsert: false,
        });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);

      // Read width/height for later DPI checks (best-effort).
      const dims = await readImageDims(input.file).catch(() => null);

      const { data, error } = await supabase
        .from('memoir_assets')
        .insert({
          project_id: input.projectId,
          kind: 'photo_digital',
          storage_path: path,
          caption: input.caption?.trim() || null,
          chapter_assignment: input.chapterAssignment ?? null,
          date_estimate: input.dateEstimate?.trim() || null,
          width_px: dims?.w ?? null,
          height_px: dims?.h ?? null,
        } as any)
        .select()
        .single();
      if (error) {
        // Best-effort: don't leave an orphan file in storage.
        await supabase.storage.from(ASSETS_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
      return data as MemoirAsset;
    },
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ['memoir-assets', asset.project_id] });
    },
  });
}

export function useUpdateMemoirAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string; patch: Partial<MemoirAsset> }) => {
      const { error } = await supabase
        .from('memoir_assets')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-assets', vars.projectId] });
    },
  });
}

export function useDeleteMemoirAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string; storagePath: string }) => {
      await supabase.storage.from(ASSETS_BUCKET).remove([input.storagePath]).catch(() => {});
      const { error } = await supabase.from('memoir_assets').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-assets', vars.projectId] });
    },
  });
}

/** Short-lived signed URL for displaying an asset thumbnail in the UI. */
export async function getAssetDisplayUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function readImageDims(file: File): Promise<{ w: number; h: number } | null> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// ── Co-writer mode ──────────────────────────────────────────────────

export interface CowriterDraft {
  draft: string;
  phrases_used_verbatim: string[];
}

/** Ask Claude (Opus) to draft prose from a single Q+A. The writer
 *  reviews, accepts, edits, or rejects. Fail-soft per the endpoint. */
export function useMemoirCowriter() {
  return useMutation({
    mutationFn: async (input: { question: string; transcript: string }): Promise<CowriterDraft> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/memoir-cowriter', {
        method: 'POST', headers,
        body: JSON.stringify({ question: input.question, transcript: input.transcript }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? `Co-writer failed (${res.status})`);
      return {
        draft: j.draft ?? '',
        phrases_used_verbatim: j.phrases_used_verbatim ?? [],
      };
    },
  });
}

/** Persist the draft + user's decision back to the response row. */
export function useResolveCowriterDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      responseId: string;
      projectId: string;
      draft: string;
      choice: 'accept_draft' | 'edit_draft' | 'reject';
      finalText: string;
    }) => {
      const { error } = await supabase
        .from('memoir_responses')
        .update({
          cowriter_draft: input.draft,
          user_chose: input.choice,
          final_text: input.finalText,
        } as any)
        .eq('id', input.responseId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['memoir-responses', vars.projectId] });
    },
  });
}

// ── Voice transcription ─────────────────────────────────────────────

/** Send recorded audio to /api/memoir-transcribe and get text back.
 *  Throws with a readable message on failure (incl. 503 when the
 *  provider key isn't configured) so the UI can fall back gracefully. */
export function useMemoirTranscribe() {
  return useMutation({
    mutationFn: async (input: { blob: Blob; mime: string }): Promise<string> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': input.mime };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/memoir-transcribe', {
        method: 'POST',
        headers,
        body: input.blob,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error ?? `Transcription failed (${res.status})`);
      }
      return (j.text as string) ?? '';
    },
  });
}

// ── Book rendering (KDP pipeline) ───────────────────────────────────

/** Latest renders for a project. Polls every 4s while one is still
 *  pending/rendering so the UI updates without a manual refresh. */
export function useMemoirRenders(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['memoir-renders', projectId],
    queryFn: async (): Promise<MemoirBookRender[]> => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('memoir_book_renders')
        .select('id, project_id, status, error, page_count, spine_width_in, interior_pdf_path, cover_pdf_path, epub_path, rendered_at')
        .eq('project_id', projectId)
        .order('rendered_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as MemoirBookRender[];
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const rows = (query.state.data as MemoirBookRender[]) ?? [];
      const busy = rows.some((r) => r.status === 'pending' || r.status === 'rendering');
      return busy ? 4000 : false;
    },
  });
}

/** Kick off a render via the Netlify trigger. Returns the render id. */
export function useRenderBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string): Promise<string> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/memoir-render', {
        method: 'POST',
        headers,
        body: JSON.stringify({ project_id: projectId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) {
        throw new Error(j?.error ?? `Render failed to start (${res.status})`);
      }
      return j.render_id as string;
    },
    onSuccess: (_id, projectId) => {
      qc.invalidateQueries({ queryKey: ['memoir-renders', projectId] });
    },
  });
}

/** Mint a short-lived signed URL for a stored book artifact. The
 *  caller's session must own the project (enforced by storage RLS). */
export async function getBookDownloadUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BOOKS_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[memoir] signed url failed', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Opt-in grammar/typo check for the user's final text. Unchanged
 *  from milestone 12 — Haiku-backed, returns surgical edits. */
export function useMemoirGrammarCheck() {
  return useMutation({
    mutationFn: async (input: { text: string; responseId?: string }): Promise<GrammarEdit[]> => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/memoir-edit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: input.text, response_id: input.responseId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Editor failed (${res.status})`);
      }
      const j = (await res.json()) as { edits: GrammarEdit[] };
      return j.edits ?? [];
    },
  });
}
