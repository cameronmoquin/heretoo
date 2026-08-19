/**
 * Things that have been sent but not yet acknowledged.
 *
 * They live HERE and not in the react-query cache, which is the whole
 * point. The optimistic bubble used to be written straight into
 * ['thread-messages', id] — the same array every refetch overwrites. On
 * a desktop that array is refetched almost never, so nobody noticed. On
 * a phone it is refetched constantly:
 *
 *   - mark_thread_read invalidates it on success, which means every
 *     reply to an unread message races a refetch by construction.
 *   - every realtime rejoin invalidates the whole 'thread-messages'
 *     prefix, and a phone's socket rejoins on every screen lock and
 *     every wifi/cellular handoff.
 *   - staleTime is 0 and refetchOnWindowFocus is 'always' on an open
 *     thread (deliberately — a locked screen means the socket missed
 *     inserts it will never be told about), so backgrounding, the app
 *     switcher and a pulled-down notification each cost a refetch.
 *
 * None of that is mobile-only. What is mobile-only is the width of the
 * window: a send over cellular takes long enough for one of them to
 * land inside it, where the same race on a desk resolves in 80ms.
 *
 * SCOPES. Chat messages are not the only thing sent from that composer —
 * a burning drop writes to `posts` and had no optimism at all, so it sat
 * invisible until a refetch caught up. Rather than grow a second copy of
 * this machinery (this codebase has already paid for a fix landing in
 * one copy of a pattern that existed in five), entries are filed under a
 * scope string: `msg:<threadId>` for chat, `drop:<threadId>` for drops.
 * The matching rules below do not care which is which.
 */

import { create } from 'zustand';

export interface PendingItem {
  tempId: string;
  /** `msg:<threadId>` or `drop:<threadId>`. */
  scope: string;
  senderId: string;
  body: string;
  /** Client clock, floored past everything we already know about. */
  createdAt: string;
  /** The real row's id, once the insert has answered. */
  settledId?: string;
  /**
   * Every row id the scope already held when this was queued.
   *
   * This is what makes the fuzzy match safe. Matching on sender + body
   * alone would retire a bubble against a message the user sent an hour
   * ago; the first attempt guarded that with a timestamp window, which
   * was wrong in both directions — the floor stamps a pending item at
   * newest+1ms, so on a lagging device clock the newest existing row sat
   * inside any tolerance you picked. A row that was not there when we
   * queued cannot be a row from an hour ago, and no clock is involved.
   */
  knownIds: Set<string>;
}

/** The shape the matcher needs. Callers project their rows into it. */
export interface MatchableRow {
  id: string;
  sender_id: string;
  body: string;
}

interface PendingState {
  byScope: Record<string, PendingItem[]>;
  add: (m: PendingItem) => void;
  /** The insert answered. Keep drawing until the real row shows up. */
  settle: (scope: string, tempId: string, realId: string) => void;
  /** The insert failed. Stop drawing, nothing was claimed. */
  remove: (scope: string, tempId: string) => void;
  /**
   * The row arrived and this bubble is done. Drops the entry AND hands
   * its row id to everyone still waiting.
   *
   * The hand-off is the point. A claim used to live only in the working
   * set of whoever was matching at that moment, so deleting a finished
   * bubble released its row — and the next pending item with the same
   * text immediately matched it and vanished while its own insert was
   * still in flight. Writing the id into the survivors' knownIds makes
   * the claim permanent and independent of who is still in the list.
   */
  retire: (scope: string, tempId: string, rowId: string) => void;
}

export const usePendingItems = create<PendingState>((set) => ({
  byScope: {},

  add: (m) => set((s) => ({
    byScope: { ...s.byScope, [m.scope]: [...(s.byScope[m.scope] ?? []), m] },
  })),

  settle: (scope, tempId, realId) => set((s) => {
    const list = s.byScope[scope];
    if (!list) return s;
    return {
      byScope: {
        ...s.byScope,
        [scope]: list.map((p) => (p.tempId === tempId ? { ...p, settledId: realId } : p)),
      },
    };
  }),

  remove: (scope, tempId) => set((s) => {
    const list = s.byScope[scope];
    if (!list) return s;
    const next = list.filter((p) => p.tempId !== tempId);
    const byScope = { ...s.byScope };
    if (next.length === 0) delete byScope[scope];
    else byScope[scope] = next;
    return { byScope };
  }),

  retire: (scope, tempId, rowId) => set((s) => {
    const list = s.byScope[scope];
    if (!list) return s;
    const next = list
      .filter((p) => p.tempId !== tempId)
      .map((p) => {
        if (!rowId || p.knownIds.has(rowId)) return p;
        const knownIds = new Set(p.knownIds);
        knownIds.add(rowId);
        return { ...p, knownIds };
      });
    const byScope = { ...s.byScope };
    if (next.length === 0) delete byScope[scope];
    else byScope[scope] = next;
    return { byScope };
  }),
}));

/** Nothing pending is the common case; keep the same array identity for it. */
const NONE: PendingItem[] = [];

export function pendingFor(byScope: Record<string, PendingItem[]>, scope: string | null) {
  return (scope && byScope[scope]) || NONE;
}

/**
 * Stamp for a new pending item: later than every row and every item
 * already in flight, whatever the device clock says.
 *
 * The floor has to clear what is in flight too, not just the fetched
 * rows. Pending items are deliberately not in the query cache, so two
 * taps inside one round trip both read the same newest and both stamped
 * newest+1ms — identical, and their order after that was whatever the
 * sort happened to do.
 */
export function nextStamp(rowTimes: Array<string | null | undefined>, inFlight: PendingItem[]): string {
  const newest = Math.max(
    0,
    ...rowTimes.map((t) => (t ? Date.parse(t) || 0 : 0)),
    ...inFlight.map((p) => Date.parse(p.createdAt) || 0),
  );
  return new Date(Math.max(Date.now(), newest + 1)).toISOString();
}

/**
 * Which server row, if any, each pending item corresponds to.
 *
 * Two ways an item is accounted for. The precise one: the insert
 * answered with an id and that id is now in the fetched list. The fuzzy
 * one: a thread's realtime channel does NOT filter out self-inserts, so
 * a refetch it triggers can deliver the real row BEFORE the insert's
 * promise resolves — at which point there is no id to match on yet and
 * the item would draw twice. A row that was absent when we queued, from
 * us, with our text, is that row.
 *
 * ONE SERVER ROW ACCOUNTS FOR AT MOST ONE ITEM, so sending the same word
 * twice still shows twice. That is why the settled pass runs first and
 * claims its rows: it used to return early WITHOUT claiming, which left
 * the row free for the next identical item to match, and the second
 * bubble vanished while its own insert was still in flight.
 */
export function matchRows(pending: PendingItem[], serverRows: MatchableRow[]): Map<string, string> {
  const out = new Map<string, string>();
  if (pending.length === 0) return out;
  const ids = new Set(serverRows.map((m) => m.id));

  // Pass one: every settled item claims its row, before any fuzzy match
  // can take it. Order within `pending` must not decide who wins.
  const claimed = new Set<string>();
  for (const p of pending) {
    if (p.settledId && ids.has(p.settledId)) {
      claimed.add(p.settledId);
      out.set(p.tempId, p.settledId);
    }
  }

  // Pass two: the rest match against what is left.
  for (const p of pending) {
    if (out.has(p.tempId)) continue;
    const match = serverRows.find((m) =>
      !claimed.has(m.id)
      && !p.knownIds.has(m.id)
      && m.sender_id === p.senderId
      && m.body === p.body,
    );
    if (match) { claimed.add(match.id); out.set(p.tempId, match.id); }
  }

  return out;
}

/**
 * The items still worth drawing. Always call with the COMPLETE pending
 * list for the scope — the claim bookkeeping lives in that list, so
 * feeding this function its own output lets a row account for a second
 * item.
 */
export function unsettled(pending: PendingItem[], serverRows: MatchableRow[]): PendingItem[] {
  if (pending.length === 0) return NONE;
  const matched = matchRows(pending, serverRows);
  return pending.filter((p) => !matched.has(p.tempId));
}
