/**
 * The half of optimistic sending that is easy to get wrong, in one place.
 *
 * Both callers — chat messages and burning drops — need the same three
 * things, and each of them has already been a bug:
 *
 *   1. Retirement is a DRAWING decision, recomputed every render. It is
 *      not a deletion. A refetch that started before the INSERT committed
 *      resolves afterwards and replaces the array WITHOUT the new row; if
 *      the entry had already been deleted there was nothing left to draw
 *      the bubble again, so the message showed and then disappeared. That
 *      was the original bug moved one step later, not fixed. Keeping the
 *      entry means the row going missing simply brings the bubble back.
 *
 *   2. Dropping the entry is a separate step, held back long enough to
 *      outlast any refetch that was already in the air.
 *
 *   3. Matching runs against the WHOLE pending list, never against its
 *      own output. unsettled() allocates a fresh claim set per call, so
 *      feeding it a shrunken list frees a row that had already accounted
 *      for one item, and a duplicate send lost its second bubble one
 *      pass at a time.
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  usePendingItems, pendingFor, unsettled, matchRows,
  type PendingItem, type MatchableRow,
} from '../stores/pendingMessages';

/**
 * How long a retired item keeps its entry before it is thrown away.
 *
 * Long enough to outlast any refetch that was already in the air when
 * the row committed, since such a refetch resolves without it and would
 * otherwise erase something nothing could redraw.
 */
export const RETIRE_GRACE_MS = 15_000;

/**
 * @param scope   `msg:<threadId>` or `drop:<threadId>`
 * @param rows    the server's rows, projected to {id, sender_id, body}
 * @param latest  reads those same rows as they stand NOW — called from a
 *                timer, long after the render that set it, so it must go
 *                to the cache rather than close over `rows`.
 */
export function usePendingLive(
  scope: string | null,
  rows: MatchableRow[],
  latest: () => MatchableRow[],
): PendingItem[] {
  const byScope = usePendingItems((s) => s.byScope);
  const retire = usePendingItems((s) => s.retire);
  const pending = pendingFor(byScope, scope);

  // Held in a ref so a fresh closure every render does not restart the
  // grace timer and starve retirement on a busy thread.
  const latestRef = useRef(latest);
  latestRef.current = latest;

  const live = useMemo(
    () => (pending.length > 0 ? unsettled(pending, rows) : pending),
    [pending, rows],
  );

  const retiredKey = useMemo(() => {
    if (pending.length === live.length) return '';
    const drawn = new Set(live.map((p) => p.tempId));
    return pending.filter((p) => !drawn.has(p.tempId)).map((p) => p.tempId).join(',');
  }, [pending, live]);

  useEffect(() => {
    if (!scope || !retiredKey) return;
    const ids = new Set(retiredKey.split(','));
    const t = setTimeout(() => {
      // Re-decided against the rows as they stand NOW, not as they stood
      // when the timer was set. Anything that has gone missing in the
      // meantime keeps its entry and keeps drawing.
      //
      // Matched against the WHOLE list, not just the entries being
      // dropped: the claim bookkeeping only works on the complete set.
      // Each drop then hands its row id to the survivors so the claim
      // does not die with the entry that made it.
      const all = usePendingItems.getState().byScope[scope] ?? [];
      const matched = matchRows(all, latestRef.current());
      for (const p of all) {
        if (!ids.has(p.tempId)) continue;
        const rowId = matched.get(p.tempId);
        if (rowId) retire(scope, p.tempId, rowId);
      }
    }, RETIRE_GRACE_MS);
    return () => clearTimeout(t);
  }, [scope, retiredKey, retire]);

  return live;
}
