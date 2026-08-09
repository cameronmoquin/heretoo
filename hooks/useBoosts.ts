/**
 * Post boosts — caller picks the scope at boost time.
 * Backed by `post_boosts` table from migration 002.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type BoostScope = 'public' | 'connections' | 'family';

export function useBoostPost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      originalPostId: string;
      scope: BoostScope;
      familyId?: string;
      caption?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      if (input.scope === 'family' && !input.familyId) {
        throw new Error('familyId is required when scope = family');
      }
      const { data, error } = await supabase
        .from('post_boosts')
        .insert({
          original_post_id: input.originalPostId,
          booster_id: userId,
          scope: input.scope,
          family_id: input.scope === 'family' ? input.familyId : null,
          caption: input.caption ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['family-feed'] });
      // A boost shows anywhere the post shows.
      qc.invalidateQueries({ queryKey: ['family-updates'] });
      qc.invalidateQueries({ queryKey: ['profile-posts'] });
      qc.invalidateQueries({ queryKey: ['user-posts'] });
      qc.invalidateQueries({ queryKey: ['post'] });
    },
  });
}
