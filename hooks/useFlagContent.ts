/**
 * Content flagging — report a post or comment to the moderation queue.
 *
 * Calls flag_content() RPC. The RPC enforces:
 *   - exactly one of post_id / comment_id
 *   - reason in the allowed enum
 *   - 'other' requires a note
 *   - one flag per (user, item) — duplicates silently no-op
 *
 * The aim isn't perfect AI-driven moderation but a real triage path:
 * once N distinct flaggers report something, it auto-hides pending
 * review (see the active_flagged_* views in migration 024).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type FlagReason = 'hate' | 'spam' | 'misinfo' | 'sexual' | 'other';

export const FLAG_REASONS: Array<{ id: FlagReason; label: string; sub: string }> = [
  { id: 'hate', label: 'Hate or harassment', sub: 'Threats, slurs, or targeted abuse.' },
  { id: 'spam', label: 'Spam', sub: 'Promotional, repetitive, or off-topic.' },
  { id: 'misinfo', label: 'Misinformation', sub: 'Provably false. Especially health or safety.' },
  { id: 'sexual', label: 'Sexual content', sub: 'Not appropriate here.' },
  { id: 'other', label: 'Something else', sub: 'Tell us in your own words below.' },
];

export function useFlagContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      postId?: string;
      commentId?: string;
      reason: FlagReason;
      note?: string;
    }) => {
      const { error } = await supabase.rpc('flag_content', {
        p_post_id: input.postId ?? null,
        p_comment_id: input.commentId ?? null,
        p_reason: input.reason,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Refresh feeds so any newly auto-hidden item drops out.
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['family-feed'] });
      qc.invalidateQueries({ queryKey: ['family-updates'] });
    },
  });
}
