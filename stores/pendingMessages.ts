/**
 * Messages that have been sent but not yet acknowledged.
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
 * Any one of those resolving before the INSERT commits replaced the
 * array with server rows that did not contain the new message yet, and
 * the bubble disappeared until the round-trip finished. That is the
 * "inconsistent optimism": the bubble was never guaranteed, it was
 * racing.
 *
 * A refetch cannot touch this store. The bubble is drawn from here,
 * merged over the server rows at render, and only stops being drawn
 * once the real row is provably in hand.
 */

import { create } from 'zustand';

export interface PendingMessage {
  tempId: string;
  threadId: string;
  senderId: string;
  body: string;
  /** Client clock, floored past everything we already know about. */
  createdAt: string;
  /** The real row's id, once the insert has answered. */
  settledId?: string;
  /**
   * Every message id the thread already held when this was queued.
   *
   * This is what makes the fuzzy match safe. Matching on sender + body
   * alone would retire a bubble against a message the user sent an hour
   * ago; the first attempt guarded that with a timestamp window, which
   * was wrong in both directions — the floor below stamps a pending
   * message at newest+1ms, so on a lagging device clock the newest
   * existing row sat inside any tolerance you picked. A row that was not
   * there when we queued cannot be a row from an hour ago, and no clock
   * is involved.
   */
  knownIds: Set<string>;
}

interface PendingState {
  byThread: Record<string, PendingMessage[]>;
  add: (m: PendingMessage) => void;
  /** The insert answered. Keep drawing until the real row shows up. */
  settle: (threadId: string, tempId: string, realId: string) => void;
  /** The insert failed. Stop drawing, nothing was claimed. */
  remove: (threadId: string, tempId: string) => void;
  /**
   * The row arrived and this bubble is done. Drops the entry AND hands
   * its row id to everyone still waiting.
   *
   * The hand-off is the point. A claim used to live only in the working
   * set of whoever was matching at that moment, so deleting a finished
   * bubble released its row — and the next pending message with the same
   * text immediately matched it and vanished while its own insert was
   * still in flight. Writing the id into the survivors' knownIds makes
   * the claim permanent and independent of who is still in the list.
   */
  retire: (threadId: string, tempId: string, rowId: string) => void;
}

export const usePendingMessages = create<PendingState>((set) => ({
  byThread: {},

  add: (m) => set((s) => ({
    byThread: { ...s.byThread, [m.threadId]: [...(s.byThread[m.threadId] ?? []), m] },
  })),

  settle: (threadId, tempId, realId) => set((s) => {
    const list = s.byThread[threadId];
    if (!list) return s;
    return {
      byThread: {
        ...s.byThread,
        [threadId]: list.map((p) => (p.tempId === tempId ? { ...p, settledId: realId } : p)),
      },
    };
  }),

  remove: (threadId, tempId) => set((s) => {
    const list = s.byThread[threadId];
    if (!list) return s;
    const next = list.filter((p) => p.tempId !== tempId);
    const byThread = { ...s.byThread };
    if (next.length === 0) delete byThread[threadId];
    else byThread[threadId] = next;
    return { byThread };
  }),

  retire: (threadId, tempId, rowId) => set((s) => {
    const list = s.byThread[threadId];
    if (!list) return s;
    const next = list
      .filter((p) => p.tempId !== tempId)
      .map((p) => {
        if (!rowId || p.knownIds.has(rowId)) return p;
        const knownIds = new Set(p.knownIds);
        knownIds.add(rowId);
        return { ...p, knownIds };
      });
    const byThread = { ...s.byThread };
    if (next.length === 0) delete byThread[threadId];
    else byThread[threadId] = next;
    return { byThread };
  }),
}));

/** Nothing pending is the common case; keep the same array identity for it. */
const NONE: PendingMessage[] = [];

export function pendingFor(byThread: Record<string, PendingMessage[]>, threadId: string | null) {
  return (threadId && byThread[threadId]) || NONE;
}

/**
 * Which pending messages are still worth drawing, given what the server
 * has actually handed back.
 *
 * Two ways a bubble retires. The precise one: the insert answered with
 * an id and that id is now in the fetched list. The fuzzy one: the
 * thread's own realtime channel does NOT filter out self-inserts, so a
 * refetch it triggers can deliver the real row BEFORE the insert's
 * promise resolves — at which point there is no id to match on yet and
 * the message would draw twice. A row that was absent when we queued,
 * from us, with our text, is that row.
 *
 * ONE SERVER ROW RETIRES AT MOST ONE BUBBLE, so sending the same word
 * twice still shows twice. That is why the settled pass runs first and
 * claims its rows: it used to return early WITHOUT claiming, which left
 * the row free for the next identical message to match, and the second
 * bubble vanished while its own insert was still in flight.
 */
export function matchRows<T extends { id: string; sender_id: string; body: string }>(
  pending: PendingMessage[],
  serverRows: T[],
): Map<string, string> {
  const out = new Map<string, string>();
  if (pending.length === 0) return out;
  const ids = new Set(serverRows.map((m) => m.id));

  // Pass one: every settled bubble claims its row, before any fuzzy
  // match can take it. Order within `pending` must not decide who wins.
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
 * The bubbles still worth drawing. Always call with the COMPLETE pending
 * list for the thread — the claim bookkeeping lives in that list, so
 * feeding this function its own output lets a row retire a second bubble.
 */
export function unsettled<T extends { id: string; sender_id: string; body: string }>(
  pending: PendingMessage[],
  serverRows: T[],
): PendingMessage[] {
  if (pending.length === 0) return NONE;
  const matched = matchRows(pending, serverRows);
  return pending.filter((p) => !matched.has(p.tempId));
}
