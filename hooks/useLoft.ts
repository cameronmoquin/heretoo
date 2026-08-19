/**
 * The Loft — the pseudonymous public square.
 *
 * Expiry is the author's choice (migration 089): expires_at = null
 * means the submission stays. The old hard 24-hour timer survives only
 * as the DB default, which protects authors on stale bundles whose UI
 * still promises "24 hours, then gone".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface LoftPost {
  id: string;
  /** The author is NOT exposed (migration 087): the square is
   *  anonymous, and handing out author_id let any member resolve a
   *  pseudonym to a real name in one more request. is_mine answers the
   *  only question this ever served. */
  is_mine?: boolean;
  body: string;
  pseudonym: string;
  created_at: string;
  /** null = stays (089). A stamp means it leaves at that time. */
  expires_at: string | null;
}

/** Fetch the active Loft feed — non-expired posts, newest first. */
export function useLoftFeed() {
  return useQuery({
    queryKey: ['loft-feed'],
    queryFn: async (): Promise<LoftPost[]> => {
      // The view already refuses expired rows; this filter only keeps a
      // stale client honest between refetches. or() rather than gt()
      // because gt() silently drops the null-stamped rows that stay.
      const { data, error } = await supabase
        .from('square')
        .select('*')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as LoftPost[];
    },
    // Loft posts are time-sensitive; refetch on focus + every 60s.
    refetchInterval: 60_000,
  });
}

/** Returns the user's stable Loft pseudonym, generating one on first
 *  call. Cached forever unless the user explicitly regenerates. */
export function useLoftHandle() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['loft-handle', userId],
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('claim_loft_handle');
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[loft] claim_loft_handle failed', error.message);
        return null;
      }
      return (data as string) ?? null;
    },
    enabled: !!userId,
    staleTime: Infinity,
    retry: 2,
  });
}

/** Roll a new pseudonym. The user clicks "Change" in the Loft sub-bar. */
export function useRegenerateLoftHandle() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('regenerate_loft_handle');
      if (error) throw error;
      return data as string;
    },
    onSuccess: (newHandle) => {
      qc.setQueryData(['loft-handle', userId], newHandle);
    },
  });
}

/** Post to the Loft. Server-side denormalizes the pseudonym so any
 *  later change to loft_handle doesn't rewrite history. Optimistic —
 *  the post appears in the feed the instant the user taps Post. */
export function useCreateLoftPost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { body: string; expire24h: boolean }): Promise<LoftPost> => {
      const { body, expire24h } = input;
      if (!userId) throw new Error('Not signed in');
      // Resolve the user's current pseudonym (will create one if needed).
      // Defer hard-failure on handle generation to the insert step so the
      // optimistic post still gets to render.
      let pseudonym = 'you';
      try {
        const { data: handleData } = await supabase.rpc('claim_loft_handle');
        if (typeof handleData === 'string' && handleData.length > 0) {
          pseudonym = handleData;
        }
      } catch {}

      // The stamp is explicit either way. Omitting the column would let
      // the DB default quietly re-impose 24 hours on a submission whose
      // author chose to keep it.
      const { data, error } = await supabase
        .from('loft_posts')
        .insert({
          author_id: userId,
          body: body.trim(),
          pseudonym,
          expires_at: expire24h
            ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            : null,
        } as any)
        .select('id, body, pseudonym, created_at, expires_at')
        .single();
      if (error) {
        // 23502 = migration 089 has not run and null hit the old NOT
        // NULL. Refusing is right; silently making the post vanish in a
        // day when the author chose "stays" would be the wrong kind of
        // helpful.
        if ((error as any).code === '23502' && !expire24h) {
          throw new Error('Lasting public submissions are not switched on yet. Arm the hourglass, or try later.');
        }
        throw error;
      }
      return data as LoftPost;
    },

    // Optimistic: drop a placeholder into the feed cache the instant
    // the user taps Post. The real row replaces it on success.
    onMutate: async (input) => {
      if (!userId) return { prev: null as LoftPost[] | null };
      const key = ['loft-feed'];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LoftPost[]>(key) ?? [];

      // Best-effort pseudonym for the placeholder. If we have it
      // cached from a previous claim, use that; otherwise show "you"
      // until the real row lands.
      const cachedHandle = qc.getQueryData<string | null>(['loft-handle', userId]) ?? 'you';

      const optimistic: LoftPost = {
        id: `optimistic-${Date.now()}`,
        is_mine: true,
        body: input.body.trim(),
        pseudonym: cachedHandle,
        created_at: new Date().toISOString(),
        expires_at: input.expire24h
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      };
      qc.setQueryData<LoftPost[]>(key, [optimistic, ...prev]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back on failure.
      if (ctx && Array.isArray(ctx.prev)) {
        qc.setQueryData(['loft-feed'], ctx.prev);
      }
    },
    onSuccess: (real) => {
      // Replace optimistic with the real row.
      const cur = qc.getQueryData<LoftPost[]>(['loft-feed']) ?? [];
      const next = cur.map((p) => (p.id.startsWith('optimistic-') && p.body === real.body ? real : p));
      qc.setQueryData(['loft-feed'], next);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['loft-feed'] });
    },
  });
}

/** Author can delete a Loft post early. */
export function useDeleteLoftPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loft_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loft-feed'] });
    },
  });
}
