/**
 * The Loft — pseudonymous, 24-hour-expiry, modernist wing of HereToo.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface LoftPost {
  id: string;
  author_id: string;
  body: string;
  pseudonym: string;
  created_at: string;
  expires_at: string;
}

/** Fetch the active Loft feed — non-expired posts, newest first. */
export function useLoftFeed() {
  return useQuery({
    queryKey: ['loft-feed'],
    queryFn: async (): Promise<LoftPost[]> => {
      const { data, error } = await supabase
        .from('loft_posts')
        .select('*')
        .gt('expires_at', new Date().toISOString())
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
 *  call. Cached forever — pseudonyms don't change unless the user
 *  explicitly resets (a future feature). */
export function useLoftHandle() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['loft-handle', userId],
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('claim_loft_handle');
      if (error) throw error;
      return (data as string) ?? null;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}

/** Post to the Loft. Server-side denormalizes the pseudonym so any
 *  later change to loft_handle doesn't rewrite history. */
export function useCreateLoftPost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (body: string): Promise<LoftPost> => {
      if (!userId) throw new Error('Not signed in');
      // Resolve the user's current pseudonym (will create one if needed).
      const { data: handleData, error: hErr } = await supabase.rpc('claim_loft_handle');
      if (hErr) throw hErr;
      const pseudonym = (handleData as string) || 'guest';

      const { data, error } = await supabase
        .from('loft_posts')
        .insert({ author_id: userId, body: body.trim(), pseudonym } as any)
        .select()
        .single();
      if (error) throw error;
      return data as LoftPost;
    },
    onSuccess: () => {
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
