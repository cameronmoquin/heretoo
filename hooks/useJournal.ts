/**
 * useJournal — the private journal.
 *
 * Same writing surface as the memoir, two destinations. An entry stays
 * open, readable, and can go on to become a book. Or it gets sealed,
 * and the words leave the network entirely.
 *
 * Sealing runs in lib/vault.ts before anything touches supabase. The
 * mutation below takes plaintext, seals it here, and sends only the
 * ciphertext. The plaintext never enters a query cache, never lands in
 * a mutation variable that react-query retains, and never reaches the
 * wire. Read useSealJournalEntry carefully before changing it.
 *
 * Opening is deliberately not a query. A decrypted body is not cache
 * data. It is held in component state for as long as the user is
 * looking at it and dropped when they leave.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { sealEntry, openEntry, type SealedEntry } from '../lib/vault';

// ── Types ──────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  author_id: string;
  /** Plaintext even on sealed entries, so the author can find the row.
   *  The compose screen warns about this. */
  title: string | null;
  sealed: boolean;
  /** Present only when sealed is false. */
  body: string | null;
  /** Present only when sealed is true. */
  ciphertext: string | null;
  iv: string | null;
  salt: string | null;
  iterations: number | null;
  crypto_v: number | null;
  created_at: string;
  updated_at: string;
}

/** Pull the vault payload off a row. Null when the row is not sealed
 *  or the payload is incomplete. */
export function sealedPayload(entry: JournalEntry): SealedEntry | null {
  if (!entry.sealed) return null;
  const { ciphertext, iv, salt, iterations, crypto_v } = entry;
  if (!ciphertext || !iv || !salt || iterations == null || crypto_v == null) return null;
  return { ciphertext, iv, salt, iterations, v: crypto_v };
}

// ── Queries ────────────────────────────────────────────────────────

/** Every entry the author owns, newest first. RLS already scopes this
 *  to the author. The explicit filter keeps the query key accurate. */
export function useJournalEntries() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['journal-entries', userId],
    queryFn: async (): Promise<JournalEntry[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JournalEntry[];
    },
    enabled: !!userId,
  });
}

/** Monotonic temp id for optimistic rows. A module counter is enough:
 *  it only has to stay unique inside one session's cache until the
 *  server row replaces it. */
let optimisticSeq = 0;
function tempId(): string {
  optimisticSeq += 1;
  return `optimistic-${optimisticSeq}-${Date.now()}`;
}

/** A synthetic list row, shown the instant the user saves and swapped
 *  for the server row on success. The sealed variant carries NO
 *  plaintext, matching the row the server will hand back. */
function optimisticEntry(input: {
  id: string; authorId: string; title: string;
  sealed: boolean; body: string | null;
}): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: input.id,
    author_id: input.authorId,
    title: input.title.trim() || null,
    sealed: input.sealed,
    body: input.sealed ? null : input.body,
    ciphertext: null, iv: null, salt: null, iterations: null, crypto_v: null,
    created_at: now,
    updated_at: now,
  };
}

export function useJournalEntry(entryId: string | null | undefined) {
  return useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: async (): Promise<JournalEntry | null> => {
      if (!entryId) return null;
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('id', entryId)
        .maybeSingle();
      if (error) throw error;
      return (data as JournalEntry) ?? null;
    },
    enabled: !!entryId,
    staleTime: 60_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

/** Save an open entry. Body goes to the server as written.
 *
 * Optimistic on purpose. The old version invalidated on success and
 * leaned on a refetch to show the new row, and that refetch could read
 * the list a beat before the insert was visible, so the entry only
 * appeared after the NEXT save. Here the row lands in the cache the
 * instant the user commits, then the server row replaces it. No refetch
 * sits in the critical path, so nothing races. */
export function useSaveJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['journal-entries', userId] as const;
  return useMutation({
    mutationFn: async (input: { title: string; body: string }) => {
      if (!userId) throw new Error('Sign in first.');
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          author_id: userId,
          title: input.title.trim() || null,
          sealed: false,
          body: input.body,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as JournalEntry;
    },
    onMutate: async (input) => {
      if (!userId) return { snapshot: undefined, tempId: null };
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<JournalEntry[]>(key);
      const id = tempId();
      const row = optimisticEntry({ id, authorId: userId, title: input.title, sealed: false, body: input.body });
      qc.setQueryData<JournalEntry[]>(key, (prev) => [row, ...(prev ?? [])]);
      return { snapshot, tempId: id };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (serverRow, _input, ctx) => {
      // Swap the temp row for the real one. The list is now authoritative
      // with no refetch, so the racing invalidation is gone for good.
      qc.setQueryData<JournalEntry[]>(key, (prev) =>
        (prev ?? []).map((e) => (e.id === ctx?.tempId ? serverRow : e)));
    },
  });
}

/**
 * Seal an entry and save it.
 *
 * The plaintext argument is consumed inside mutationFn and dies there.
 * react-query keeps mutation variables around after the call settles,
 * so we hand it an id-only result and never surface the body again.
 *
 * If sealing throws, nothing is written. A half-sealed row cannot
 * exist, the check constraint would reject it anyway.
 */
export function useSealJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['journal-entries', userId] as const;
  return useMutation({
    mutationFn: async (input: {
      title: string;
      /** Plaintext. Sealed before the network call. Never persisted. */
      body: string;
      passphrase: string;
    }): Promise<JournalEntry> => {
      if (!userId) throw new Error('Sign in first.');

      // Seal first. A throw here means nothing reaches the server.
      const payload = await sealEntry(input.body, input.passphrase);

      // Selecting the full row is safe: body is null and the ciphertext
      // is encrypted. No plaintext returns, so the list cache can hold
      // the row and stay openable without a refetch.
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          author_id: userId,
          title: input.title.trim() || null,
          sealed: true,
          body: null,
          ciphertext: payload.ciphertext,
          iv: payload.iv,
          salt: payload.salt,
          iterations: payload.iterations,
          crypto_v: payload.v,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as JournalEntry;
    },
    onMutate: async (input) => {
      if (!userId) return { snapshot: undefined, tempId: null };
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<JournalEntry[]>(key);
      const id = tempId();
      // sealed: true, body null. The plaintext never touches the cache.
      const row = optimisticEntry({ id, authorId: userId, title: input.title, sealed: true, body: null });
      qc.setQueryData<JournalEntry[]>(key, (prev) => [row, ...(prev ?? [])]);
      return { snapshot, tempId: id };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (serverRow, _input, ctx) => {
      qc.setQueryData<JournalEntry[]>(key, (prev) =>
        (prev ?? []).map((e) => (e.id === ctx?.tempId ? serverRow : e)));
    },
  });
}

/**
 * Seal an entry that is currently open. The plaintext body is dropped
 * from the row in the same update that writes the ciphertext.
 *
 * One way. There is no unseal-in-place, because unsealing would mean
 * writing plaintext back to a row the user already decided to close.
 * They can open it, read it, and write a new entry if they want it
 * back in the open.
 */
export function useSealExistingEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: string;
      passphrase: string;
    }): Promise<{ id: string }> => {
      const payload = await sealEntry(input.body, input.passphrase);
      const { error } = await supabase
        .from('journal_entries')
        .update({
          sealed: true,
          body: null,
          ciphertext: payload.ciphertext,
          iv: payload.iv,
          salt: payload.salt,
          iterations: payload.iterations,
          crypto_v: payload.v,
        } as any)
        .eq('id', input.id);
      if (error) throw error;
      return { id: input.id };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journal-entries', userId] });
      qc.invalidateQueries({ queryKey: ['journal-entry', vars.id] });
    },
  });
}

/** Edit an open entry. Rejects sealed rows, there is nothing to edit
 *  without the passphrase and we are not asking for it here. */
export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { id: string; title?: string; body?: string }) => {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title.trim() || null;
      if (input.body !== undefined) patch.body = input.body;
      const { error } = await supabase
        .from('journal_entries')
        .update(patch as any)
        .eq('id', input.id)
        .eq('sealed', false);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journal-entries', userId] });
      qc.invalidateQueries({ queryKey: ['journal-entry', vars.id] });
    },
  });
}

/** Retitle a sealed entry. The title was always plaintext, so this
 *  needs no passphrase and touches no ciphertext. */
export function useRetitleJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { id: string; title: string }) => {
      const { error } = await supabase
        .from('journal_entries')
        .update({ title: input.title.trim() || null } as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journal-entries', userId] });
      qc.invalidateQueries({ queryKey: ['journal-entry', vars.id] });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['journal-entries', userId] as const;
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', input.id);
      if (error) throw error;
    },
    // Optimistic, same reasoning as the create path: the row leaves the
    // list the instant the user confirms, no refetch in the critical
    // path to race. Restored on error.
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const snapshot = qc.getQueryData<JournalEntry[]>(key);
      qc.setQueryData<JournalEntry[]>(key, (prev) =>
        (prev ?? []).filter((e) => e.id !== input.id));
      return { snapshot };
    },
    onError: (_e, _input, ctx) => {
      if (ctx && ctx.snapshot !== undefined) qc.setQueryData(key, ctx.snapshot);
    },
    onSuccess: (_data, vars) => {
      qc.removeQueries({ queryKey: ['journal-entry', vars.id] });
    },
  });
}

// ── Opening ────────────────────────────────────────────────────────

/**
 * Decrypt a sealed entry.
 *
 * A mutation, not a query, and that is deliberate. Queries cache their
 * results. A decrypted body must never sit in the react-query cache,
 * where it would survive navigation and land in any devtools panel
 * pointed at the app. The caller holds the returned string in local
 * state and drops it on unmount.
 *
 * Throws WrongPassphraseError on a bad passphrase or altered bytes.
 * Callers should use isWrongPassphrase from lib/vault to branch.
 */
export function useOpenJournalEntry() {
  return useMutation({
    mutationFn: async (input: {
      entry: JournalEntry;
      passphrase: string;
    }): Promise<string> => {
      const payload = sealedPayload(input.entry);
      if (!payload) throw new Error('This entry is missing its sealed contents.');
      return openEntry(payload, input.passphrase);
    },
    // No onSuccess cache write. The plaintext goes to the caller and
    // nowhere else.
  });
}
