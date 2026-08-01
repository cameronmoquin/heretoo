/**
 * useBabybook. One book per child (migration 064).
 *
 * A babybook stands apart from the memoir. The memoir is one author's
 * life, told once. A babybook is one child, and a parent may keep
 * several, one per kid. Milestones on a spine, notes between them,
 * photos pinned to the moments they belong to.
 *
 * FAIL SOFT. Migration 064 is handed to the owner to run by hand, so the
 * deploy lands first. Until it runs, babybooks / babybook_entries /
 * babybook_assets do not exist. Every read here swallows the error, warns
 * once, and returns an empty list, so the room renders instead of
 * white-screening. Writes surface a real error and roll their optimistic
 * row back. This mirrors hooks/useMemoirTimeline.ts and hooks/useNews.ts.
 *
 * Photos reuse the shared assets bucket (memoir-assets, ASSETS_BUCKET in
 * hooks/useMemoir.ts). Only the DB rows are separate. The upload mechanics
 * are the memoir's, mirrored against babybook_assets.
 *
 * author_id is the signed-in user. RLS scopes every row to that author.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// ── Types ──────────────────────────────────────────────────────────

export type DatePrecision = 'year' | 'month' | 'day';
export type BabybookEntryKind = 'milestone' | 'note';

/** One row of public.babybooks. */
export interface Babybook {
  id: string;
  author_id: string;
  child_name: string;
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  cover_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

/** One row of public.babybook_entries. A milestone is a moment; a note
 *  is a line between moments. */
export interface BabybookEntry {
  id: string;
  babybook_id: string;
  author_id: string;
  kind: BabybookEntryKind;
  title: string;
  body: string | null;
  event_date: string | null;
  event_precision: DatePrecision | null;
  prompt_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One row of public.babybook_assets. Files live in the shared bucket. */
export interface BabybookAsset {
  id: string;
  babybook_id: string;
  author_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  captured_at: string | null;
  captured_precision: 'year' | 'month' | 'day' | null;
  entry_id: string | null;
  created_at: string;
}

/** A baby interview prompt. memoir_prompts where category = 'timeline_baby'
 *  and slug is null, seeded in migration 062. */
export interface BabyPrompt {
  id: string;
  primary_question: string;
  category: string;
  position: number;
}

// The shared assets bucket. Same store the memoir writes to; only the DB
// rows split. See migration 064 and ASSETS_BUCKET in hooks/useMemoir.ts.
const ASSETS_BUCKET = 'memoir-assets';

// ── Fail-soft warning (once) ───────────────────────────────────────

let warned = false;
function warnOnce(e: any) {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn('[babybook] unavailable; migration 064 may not have run', e?.message ?? e);
}

// ── Optimistic row plumbing ────────────────────────────────────────

let optimisticSeq = 0;
function tempId(): string {
  optimisticSeq += 1;
  return `optimistic-bb-${optimisticSeq}-${Date.now()}`;
}

// ── Books ──────────────────────────────────────────────────────────

/** Every book the caller keeps, oldest first. Returns [] and warns once
 *  if the table is not there yet. */
export function useBabybooks() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['babybooks', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<Babybook[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('babybooks')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as Babybook[];
    },
  });
}

function optimisticBook(input: NewBabybook, authorId: string): Babybook {
  const now = new Date().toISOString();
  return {
    id: tempId(),
    author_id: authorId,
    child_name: input.childName.trim(),
    birth_date: input.birthDate ?? null,
    birth_precision: input.birthPrecision ?? null,
    cover_storage_path: null,
    created_at: now,
    updated_at: now,
  };
}

export interface NewBabybook {
  childName: string;
  birthDate?: string | null;
  birthPrecision?: DatePrecision | null;
}

/** Create a book. Optimistic like useCreateTimelineEvent: the row lands
 *  the instant the parent commits, rolls back on error, swaps for the
 *  server row on success, then a settle invalidation reconciles order. */
export function useCreateBabybook() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['babybooks', userId] as const;

  return useMutation({
    mutationFn: async (input: NewBabybook): Promise<Babybook> => {
      if (!userId) throw new Error('Sign in first.');
      const { data, error } = await supabase
        .from('babybooks')
        .insert({
          author_id: userId,
          child_name: input.childName.trim(),
          birth_date: input.birthDate ?? null,
          birth_precision: input.birthPrecision ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Babybook;
    },
    onMutate: async (input) => {
      if (!userId) return { snapshot: undefined, tempId: null };
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<Babybook[]>(key);
      const row = optimisticBook(input, userId);
      qc.setQueryData<Babybook[]>(key, (prev) => [...(prev ?? []), row]);
      return { snapshot, tempId: row.id };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (serverRow, _input, ctx) => {
      qc.setQueryData<Babybook[]>(key, (prev) =>
        (prev ?? []).map((b) => (b.id === ctx?.tempId ? serverRow : b)));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** Patch a book: name, birth date, precision, or cover. */
export function useUpdateBabybook() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Babybook> }) => {
      const { error } = await supabase
        .from('babybooks')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['babybooks', userId] });
    },
  });
}

/** Delete a book. Optimistic, same reasoning as the create path: the row
 *  leaves the list the instant the parent confirms, restored on error.
 *  On delete the entries and photos cascade in the DB. */
export function useDeleteBabybook() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['babybooks', userId] as const;
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase.from('babybooks').delete().eq('id', input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<Babybook[]>(key);
      qc.setQueryData<Babybook[]>(key, (prev) => (prev ?? []).filter((b) => b.id !== input.id));
      return { snapshot };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (_data, vars) => {
      qc.removeQueries({ queryKey: ['babybook-entries', vars.id] });
      qc.removeQueries({ queryKey: ['babybook-photos', vars.id] });
    },
  });
}

// ── Entries ────────────────────────────────────────────────────────

/** Every entry on one book's spine, oldest first. event_date leads,
 *  undated entries fall to the end (nullsFirst: false). Empty and warned
 *  once until the table lands. */
export function useBabybookEntries(bookId: string | null | undefined) {
  return useQuery({
    queryKey: ['babybook-entries', bookId],
    enabled: !!bookId,
    staleTime: 30_000,
    queryFn: async (): Promise<BabybookEntry[]> => {
      if (!bookId) return [];
      const { data, error } = await supabase
        .from('babybook_entries')
        .select('*')
        .eq('babybook_id', bookId)
        .order('event_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as BabybookEntry[];
    },
  });
}

export interface NewBabybookEntry {
  bookId: string;
  kind: BabybookEntryKind;
  title: string;
  body?: string | null;
  eventDate?: string | null;
  eventPrecision?: DatePrecision | null;
  promptId?: string | null;
}

function optimisticEntry(input: NewBabybookEntry, authorId: string): BabybookEntry {
  const now = new Date().toISOString();
  return {
    id: tempId(),
    babybook_id: input.bookId,
    author_id: authorId,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body ?? null,
    event_date: input.eventDate ?? null,
    event_precision: input.eventPrecision ?? null,
    prompt_id: input.promptId ?? null,
    created_at: now,
    updated_at: now,
  };
}

/** Insert one entry. Optimistic, then a settle invalidation reconciles
 *  the spine's chronological sort. */
export function useCreateEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (input: NewBabybookEntry): Promise<BabybookEntry> => {
      if (!userId) throw new Error('Sign in first.');
      const { data, error } = await supabase
        .from('babybook_entries')
        .insert({
          babybook_id: input.bookId,
          author_id: userId,
          kind: input.kind,
          title: input.title.trim(),
          body: input.body ?? null,
          event_date: input.eventDate ?? null,
          event_precision: input.eventPrecision ?? null,
          prompt_id: input.promptId ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as BabybookEntry;
    },
    onMutate: async (input) => {
      if (!userId) return { snapshot: undefined, tempId: null, bookId: input.bookId };
      const key = ['babybook-entries', input.bookId] as const;
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<BabybookEntry[]>(key);
      const row = optimisticEntry(input, userId);
      qc.setQueryData<BabybookEntry[]>(key, (prev) => [row, ...(prev ?? [])]);
      return { snapshot, tempId: row.id, bookId: input.bookId };
    },
    onError: (_e, input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) {
        qc.setQueryData(['babybook-entries', input.bookId], ctx.snapshot);
      }
    },
    onSuccess: (serverRow, input, ctx) => {
      qc.setQueryData<BabybookEntry[]>(['babybook-entries', input.bookId], (prev) =>
        (prev ?? []).map((e) => (e.id === ctx?.tempId ? serverRow : e)));
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ['babybook-entries', input.bookId] });
    },
  });
}

/** Patch an entry by id. */
export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string; patch: Partial<BabybookEntry> }) => {
      const { error } = await supabase
        .from('babybook_entries')
        .update(input.patch as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['babybook-entries', vars.bookId] });
    },
  });
}

/** Delete an entry by id. Optimistic; its photos survive and the DB
 *  clears their entry_id (on delete set null). */
export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; bookId: string }) => {
      const { error } = await supabase.from('babybook_entries').delete().eq('id', input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = ['babybook-entries', input.bookId] as const;
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<BabybookEntry[]>(key);
      qc.setQueryData<BabybookEntry[]>(key, (prev) => (prev ?? []).filter((e) => e.id !== input.id));
      return { snapshot };
    },
    onError: (_e, input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) {
        qc.setQueryData(['babybook-entries', input.bookId], ctx.snapshot);
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['babybook-photos', vars.bookId] });
    },
  });
}

/** Answer a baby prompt: create a note entry that carries the prompt's
 *  id. The prompt question rides in the title, the answer in the body. */
export function useSetEntryFromPrompt() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      prompt: BabyPrompt;
      body: string;
      eventDate?: string | null;
      eventPrecision?: DatePrecision | null;
    }): Promise<BabybookEntry> => {
      if (!userId) throw new Error('Sign in first.');
      const { data, error } = await supabase
        .from('babybook_entries')
        .insert({
          babybook_id: input.bookId,
          author_id: userId,
          kind: 'note',
          title: input.prompt.primary_question,
          body: input.body.trim(),
          event_date: input.eventDate ?? null,
          event_precision: input.eventPrecision ?? null,
          prompt_id: input.prompt.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as BabybookEntry;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['babybook-entries', vars.bookId] });
    },
  });
}

// ── Photos ─────────────────────────────────────────────────────────

/** Every photo in one book, oldest capture first. Empty and warned once
 *  until the table lands. */
export function useBabybookPhotos(bookId: string | null | undefined) {
  return useQuery({
    queryKey: ['babybook-photos', bookId],
    enabled: !!bookId,
    staleTime: 30_000,
    queryFn: async (): Promise<BabybookAsset[]> => {
      if (!bookId) return [];
      const { data, error } = await supabase
        .from('babybook_assets')
        .select('*')
        .eq('babybook_id', bookId)
        .order('captured_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) {
        warnOnce(error);
        return [];
      }
      return (data ?? []) as BabybookAsset[];
    },
  });
}

/** Upload a photo file to the shared assets bucket and insert the
 *  matching babybook_assets row. Reuses the memoir upload mechanics
 *  (useUploadMemoirAsset), aimed at babybook_assets. Returns the row. */
export function useUploadBabybookPhoto() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      bookId: string;
      file: File;
      caption?: string;
      capturedAt?: string | null;
      capturedPrecision?: 'year' | 'month' | 'day' | null;
      entryId?: string | null;
    }): Promise<BabybookAsset> => {
      if (!userId) throw new Error('Sign in first.');
      const ext = (input.file.name.split('.').pop() || 'jpg').toLowerCase();
      // A local v4-ish id so the storage path is stable before the DB
      // insert. The row's own id stays gen_random_uuid().
      const localId = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : Math.random().toString(36).slice(2);
      const path = `${input.bookId}/${localId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(ASSETS_BUCKET)
        .upload(path, input.file, {
          contentType: input.file.type || 'image/jpeg',
          upsert: false,
        });
      if (upErr) throw new Error(`Upload: ${upErr.message}`);

      const { data, error } = await supabase
        .from('babybook_assets')
        .insert({
          babybook_id: input.bookId,
          author_id: userId,
          storage_path: path,
          caption: input.caption?.trim() || null,
          captured_at: input.capturedAt ?? null,
          captured_precision: input.capturedPrecision ?? null,
          entry_id: input.entryId ?? null,
        } as any)
        .select()
        .single();
      if (error) {
        // Best-effort: don't leave an orphan file in storage.
        await supabase.storage.from(ASSETS_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
      return data as BabybookAsset;
    },
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ['babybook-photos', asset.babybook_id] });
    },
  });
}

// ── Prompts ────────────────────────────────────────────────────────

/** The baby interview prompts. memoir_prompts where category =
 *  'timeline_baby' and slug is null, seeded in migration 062, in position
 *  order. Fails soft to an empty list before that migration has run. */
export function useBabyPrompts() {
  return useQuery({
    queryKey: ['baby-prompts'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BabyPrompt[]> => {
      try {
        const { data, error } = await supabase
          .from('memoir_prompts')
          .select('id, primary_question, category, position')
          .eq('category', 'timeline_baby')
          .is('slug', null)
          .order('position', { ascending: true });
        if (error) throw error;
        return (data ?? []) as BabyPrompt[];
      } catch (e) {
        warnOnce(e);
        return [];
      }
    },
  });
}
