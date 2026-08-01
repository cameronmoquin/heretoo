/**
 * Burning drops. The view record, and the reveal that writes it.
 *
 * A drop with destruct_on_view = true leaves the feed for a viewer the
 * moment that viewer has a post_views row for it. The RLS filter in
 * migration 065 does the removal. This file only decides WHEN the row
 * gets written.
 *
 * The rule: a scroll is not a read. Burning a drop nobody opened is
 * destroying content by accident. So a burning drop lands sealed and the
 * view is recorded on an explicit tap, the same shape as the deaddrop
 * seal. Nothing here fires on render, on mount, or on scroll.
 *
 * DEGRADE: migration 065 is run by hand. Until it lands, posts has no
 * destruct_on_view column, so nothing renders sealed and none of this
 * runs. If the insert fails anyway (table gone, policy gone, offline)
 * the error is swallowed and the drop still opens. Failing that way
 * leaves the drop unburned, which keeps content rather than losing it.
 *
 * post_views keys on (post_id, profile_id). profile_id IS the viewer
 * column, named that since migration 002, and unread_family_updates_for()
 * reads it by that name. It is not renamed.
 *
 * NO UPDATE. The insert ignores duplicates rather than upserting, because
 * post_views carries an INSERT policy and a SELECT policy and no UPDATE
 * policy. A burned drop stays burned.
 */

import { useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { useAuthStore } from '../stores/authStore';

/**
 * The columns migration 065 adds to posts, plus the recipient profile
 * useFeed joins for a DM drop.
 *
 * Kept here rather than on the Post type in feedStore because every one
 * of them is optional at runtime: before 065 runs the row simply does not
 * carry them, and every read site treats undefined as the old behavior.
 */
export interface DropExtras {
  /** True: this drop burns for a viewer once that viewer has opened it. */
  destruct_on_view?: boolean | null;
  /** Set only on a visibility='direct' drop. The one person it went to. */
  direct_recipient_id?: string | null;
  /** Joined profile for direct_recipient_id. RLS already restricts the row. */
  recipient?: {
    id: string;
    handle: string | null;
    display_name: string | null;
    avatar_path?: string | null;
  } | null;
}

/**
 * Which drops this session has opened.
 *
 * Held in a store keyed by post id, not in component state, because
 * FlashList recycles a PostCard instance across rows. Local state would
 * carry one drop's revealed flag onto the next drop that lands in the
 * same recycled view.
 *
 * Session-scoped on purpose. The next load asks the server, and the
 * server has already dropped the row.
 */
interface RevealState {
  revealed: Record<string, true>;
  markRevealed: (postId: string) => void;
}

const useRevealStore = create<RevealState>((set) => ({
  revealed: {},
  markRevealed: (postId) =>
    set((s) => (s.revealed[postId] ? s : { revealed: { ...s.revealed, [postId]: true } })),
}));

/** Has this session opened that drop. */
export function useRevealed(postId: string): boolean {
  return useRevealStore((s) => !!s.revealed[postId]);
}

let warned = false;
function warnOnce(e: any) {
  if (warned) return;
  warned = true;
  // eslint-disable-next-line no-console
  console.warn('[post-views] unavailable; migration 065 may not have run', e?.message ?? e);
}

/**
 * Open a sealed drop.
 *
 * Reveals first so the reader never waits on the network, then records
 * the view. The record is what burns it on the next load.
 */
export function useOpenDrop() {
  const userId = useAuthStore((s) => s.user?.id);
  const markRevealed = useRevealStore((s) => s.markRevealed);

  return useCallback(
    (postId: string) => {
      if (!postId) return;
      markRevealed(postId);
      if (DEV_MODE || !userId) return;

      void (async () => {
        try {
          const { error } = await supabase
            .from('post_views')
            .upsert(
              { post_id: postId, profile_id: userId },
              // ignoreDuplicates sends ON CONFLICT DO NOTHING, which needs
              // the INSERT policy and nothing else. A merging upsert would
              // need an UPDATE policy that deliberately does not exist.
              { onConflict: 'post_id,profile_id', ignoreDuplicates: true },
            );
          if (error) warnOnce(error);
        } catch (e) {
          warnOnce(e);
        }
      })();
    },
    [userId, markRevealed],
  );
}
