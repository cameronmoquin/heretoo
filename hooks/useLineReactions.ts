/**
 * Line reactions. Read and write.
 *
 * Rows live in post_reactions alongside hearts. A line reaction has
 * reaction_type = 'line:<category>' and line_ref pointing at the
 * quoted line. Hearts keep reaction_type = 'heart' and line_ref null,
 * and every heart path in the app filters on that, so the two never
 * cross.
 *
 * DEGRADE: migration 060 is handed to the owner to run by hand, so the
 * deploy can land first. Until it runs, line_ref does not exist and the
 * check constraint rejects any 'line:' value. Reads swallow the error
 * and return an empty list. Writes surface a real error message, which
 * is the one kind of copy this product keeps.
 *
 * NO COUNTS. Nothing here tallies reactions.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { useAuthStore } from '../stores/authStore';
import type { PaletteLine } from '../lib/lineReactions';

export interface LineReactionRow {
  id: string;
  profile_id: string;
  reaction_type: string;
  line_ref: string | null;
  created_at: string;
}

let warned = false;
function warnOnce(e: any) {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn('[line-reactions] unavailable; migration 060 may not have run', e?.message ?? e);
}

export function useLineReactions(postId: string | null) {
  return useQuery({
    queryKey: ['line-reactions', postId],
    queryFn: async (): Promise<LineReactionRow[]> => {
      if (!postId || DEV_MODE) return [];
      const { data, error } = await supabase
        .from('post_reactions')
        .select('id, profile_id, reaction_type, line_ref, created_at')
        .eq('post_id', postId)
        .neq('reaction_type', 'heart')
        .order('created_at', { ascending: true });
      if (error) {
        // 42703 = column does not exist. Anything else here is equally
        // non-fatal for a card that just wants to render.
        warnOnce(error);
        return [];
      }
      return (data ?? []) as LineReactionRow[];
    },
    enabled: !!postId,
    staleTime: 30_000,
  });
}

/**
 * Fire a line at a post. Upserts on (post_id, profile_id,
 * reaction_type) so firing a second line of the same category swaps
 * the quote instead of failing on the unique key.
 */
export function useFireLine() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({ postId, line }: { postId: string; line: PaletteLine }) => {
      if (!userId) throw new Error('Not signed in.');
      const { error } = await supabase
        .from('post_reactions')
        .upsert(
          {
            post_id: postId,
            profile_id: userId,
            reaction_type: line.key,
            line_ref: line.ref,
          },
          { onConflict: 'post_id,profile_id,reaction_type' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['line-reactions', vars.postId] });
    },
  });
}

/** Take a line back. Own rows only, enforced by the reactions_self policy. */
export function useUnfireLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reactionId }: { postId: string; reactionId: string }) => {
      const { error } = await supabase.from('post_reactions').delete().eq('id', reactionId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['line-reactions', vars.postId] });
    },
  });
}
