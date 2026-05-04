/**
 * Family-wallpaper voting hooks.
 *
 * Each family has a wallpaper that's voted on by its active members.
 * Default = the family owner's personal wallpaper (their "house"). Once
 * members vote, the plurality wins; ties go to the most recent vote.
 *
 * Three hooks:
 *   useEffectiveFamilyWallpaper(familyId) — current effective id
 *   useMyFamilyWallpaperVote(familyId)    — my own vote (or null)
 *   useVoteFamilyWallpaper()              — cast / change my vote
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { WallpaperId } from '../stores/wallpaperStore';

/** Returns the wallpaper id that should render on the family page. */
export function useEffectiveFamilyWallpaper(familyId: string | null) {
  return useQuery({
    queryKey: ['family-wallpaper', familyId],
    queryFn: async (): Promise<WallpaperId | null> => {
      if (!familyId) return null;
      const { data, error } = await supabase.rpc('effective_family_wallpaper', {
        p_family_id: familyId,
      });
      if (error) throw error;
      return (data as WallpaperId | null) ?? null;
    },
    enabled: !!familyId,
    staleTime: 30_000,
  });
}

/** What the current viewer voted for in this family (or null). */
export function useMyFamilyWallpaperVote(familyId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['family-wallpaper-my-vote', familyId, userId],
    queryFn: async (): Promise<WallpaperId | null> => {
      if (!familyId || !userId) return null;
      const { data } = await supabase
        .from('family_wallpaper_votes')
        .select('wallpaper_id')
        .eq('family_id', familyId)
        .eq('profile_id', userId)
        .maybeSingle();
      return ((data as any)?.wallpaper_id as WallpaperId) ?? null;
    },
    enabled: !!familyId && !!userId,
  });
}

/** Cast or change a vote. Optimistic — UI flips before round-trip. */
export function useVoteFamilyWallpaper() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { familyId: string; wallpaperId: WallpaperId }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('family_wallpaper_votes')
        .upsert({
          family_id: input.familyId,
          profile_id: userId,
          wallpaper_id: input.wallpaperId,
          voted_at: new Date().toISOString(),
        }, {
          onConflict: 'family_id,profile_id',
        });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const myVoteKey = ['family-wallpaper-my-vote', vars.familyId, userId];
      const effectiveKey = ['family-wallpaper', vars.familyId];
      await qc.cancelQueries({ queryKey: myVoteKey });
      const prev = {
        my: qc.getQueryData<WallpaperId | null>(myVoteKey),
        eff: qc.getQueryData<WallpaperId | null>(effectiveKey),
      };
      qc.setQueryData<WallpaperId | null>(myVoteKey, vars.wallpaperId);
      // We don't optimistically change the effective wallpaper because
      // the calculation requires server-side counts. The refetch on
      // settle picks up the new effective.
      return { prev, myVoteKey, effectiveKey };
    },
    onError: (_err, _vars, ctx: any) => {
      if (!ctx) return;
      qc.setQueryData(ctx.myVoteKey, ctx.prev.my);
      qc.setQueryData(ctx.effectiveKey, ctx.prev.eff);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ['family-wallpaper-my-vote', vars.familyId] });
      qc.invalidateQueries({ queryKey: ['family-wallpaper', vars.familyId] });
    },
  });
}
