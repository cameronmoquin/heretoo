/**
 * useMemoir — daily memoir prompt + the user's library of answers.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface MemoirPrompt {
  id: string;
  prompt: string;
  category: string;
  position: number;
}

export interface MemoirResponse {
  id: string;
  user_id: string;
  prompt_id: string;
  body: string;
  audio_url: string | null;
  is_shared: boolean;
  shared_post_id: string | null;
  created_at: string;
  prompt?: MemoirPrompt;
}

export interface MemoirProgress {
  answered_count: number;
  total_count: number;
}

export function useTodaysMemoirPrompt() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['memoir-today', userId],
    queryFn: async (): Promise<MemoirPrompt | null> => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('todays_memoir_prompt');
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[memoir] rpc failed', error.message);
        return null;
      }
      const row = ((data ?? []) as any[])[0];
      return row ? {
        id: row.id,
        prompt: row.prompt,
        category: row.category,
        position: row.position,
      } : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useMemoirResponses() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['memoir-responses', userId],
    queryFn: async (): Promise<MemoirResponse[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('memoir_responses')
        .select(`
          *,
          prompt:memoir_prompts!prompt_id(id, prompt, category, position)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemoirResponse[];
    },
    enabled: !!userId,
  });
}

export function useMemoirProgress() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['memoir-progress', userId],
    queryFn: async (): Promise<MemoirProgress> => {
      if (!userId) return { answered_count: 0, total_count: 0 };
      const { data, error } = await supabase.rpc('memoir_progress_for_viewer');
      if (error) return { answered_count: 0, total_count: 0 };
      const row = ((data ?? []) as any[])[0];
      return {
        answered_count: row?.answered_count ?? 0,
        total_count: row?.total_count ?? 0,
      };
    },
    enabled: !!userId,
  });
}

export function useSaveMemoirResponse() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      promptId: string;
      body: string;
      isShared?: boolean;
      familyId?: string | null;
    }) => {
      if (!userId) throw new Error('Not signed in');
      // Insert (or update via upsert on conflict).
      const { data, error } = await supabase
        .from('memoir_responses')
        .upsert(
          {
            user_id: userId,
            prompt_id: input.promptId,
            body: input.body.trim(),
            is_shared: !!input.isShared,
          } as any,
          { onConflict: 'user_id,prompt_id' },
        )
        .select()
        .single();
      if (error) throw error;

      // If sharing, also create a sibling post in the user's family.
      // Body prefixed with the prompt text in italics so the post
      // reads as a memoir entry, not a bare answer.
      if (input.isShared && input.familyId) {
        // Look up the prompt text for the post body.
        const { data: p } = await supabase
          .from('memoir_prompts')
          .select('prompt')
          .eq('id', input.promptId)
          .maybeSingle();
        const promptText = (p as any)?.prompt ?? '';
        const postBody = `*${promptText}*\n\n${input.body.trim()}`;
        const { data: post } = await supabase
          .from('posts')
          .insert({
            family_id: input.familyId,
            author_id: userId,
            body: postBody,
            visibility: 'family',
            kind: 'post',
          } as any)
          .select('id')
          .single();
        if ((post as any)?.id) {
          await supabase
            .from('memoir_responses')
            .update({ shared_post_id: (post as any).id } as any)
            .eq('id', (data as any).id);
        }
      }

      return data as MemoirResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memoir-today'] });
      qc.invalidateQueries({ queryKey: ['memoir-responses'] });
      qc.invalidateQueries({ queryKey: ['memoir-progress'] });
    },
  });
}
