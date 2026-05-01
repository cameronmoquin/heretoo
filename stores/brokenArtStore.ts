/**
 * Tracks art IDs whose image URLs failed to load — typically because
 * a museum's CDN deleted or moved the asset since we ingested it.
 *
 * The set is in-memory only (cleared on app reload) so transient
 * network blips don't permanently exclude pieces. If a URL is
 * persistently broken across multiple sessions, a future scheduled
 * job can read these reports server-side and prune the row.
 *
 * Components that render art read from this store to skip known-bad
 * pieces, and call `markBroken(id)` from their <Image onError> handler
 * to add a new bad ID. Subscribing to the broken-set forces a
 * re-render and a re-pick when the set grows, so the next valid
 * piece in the pool slides in on its own.
 */

import { create } from 'zustand';

interface BrokenArtState {
  broken: Set<string>;
  markBroken: (id: string) => void;
}

export const useBrokenArt = create<BrokenArtState>((set) => ({
  broken: new Set<string>(),
  markBroken: (id) => set((s) => {
    if (s.broken.has(id)) return s;
    const next = new Set(s.broken);
    next.add(id);
    return { broken: next };
  }),
}));

/**
 * Pure helper: given a shuffled pool and a logical anchor (top /
 * bottom / sidebar / inline), return the first piece that isn't in
 * the broken set. If everything is broken, returns the anchor piece
 * anyway (so the slot still tries to render — better than blank).
 */
import type { ArtWork } from '../hooks/useArtFeed';

export function pickArtAroundAnchor(
  pool: ArtWork[],
  anchorIdx: number,
  broken: Set<string>,
): ArtWork | null {
  if (pool.length === 0) return null;
  // Walk outward from the anchor — anchor first, then anchor+1, anchor-1,
  // anchor+2, anchor-2, ... so we stay close to the chosen "lane" while
  // skipping bad pieces. Eventually wraps the whole pool.
  for (let step = 0; step < pool.length; step++) {
    const offsets = step === 0 ? [0] : [step, -step];
    for (const off of offsets) {
      const idx = (anchorIdx + off + pool.length) % pool.length;
      const piece = pool[idx];
      if (piece && !broken.has(piece.id)) return piece;
    }
  }
  // All known-broken — return the anchor anyway as a last-resort.
  return pool[((anchorIdx % pool.length) + pool.length) % pool.length] ?? null;
}
