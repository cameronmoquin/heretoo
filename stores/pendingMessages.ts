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
  /** Client clock, floored to just after the newest message we know of. */
  createdAt: string;
  /** The real row's id, once the insert has answered. */
  settledId?: string;
}

interface PendingState {
  byThread: Record<string, PendingMessage[]>;
  add: (m: PendingMessage) => void;
  /** The insert answered. Keep drawing until the real row shows up. */
  settle: (threadId: string, tempId: string, realId: string) => void;
  /** The insert failed, or the real row has arrived. Stop drawing. */
  remove: (threadId: string, tempId: string) => void;
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
 * the message would draw twice. Same sender, same body, at or after the
 * moment we queued it, is that row. Each server row can only retire one
 * pending message, so sending the same word twice still shows twice.
 */
export function unsettled<T extends { id: string; sender_id: string; body: string; created_at: string }>(
  pending: PendingMessage[],
  serverRows: T[],
): PendingMessage[] {
  if (pending.length === 0) return NONE;
  const ids = new Set(serverRows.map((m) => m.id));
  const claimed = new Set<string>();
  return pending.filter((p) => {
    if (p.settledId && ids.has(p.settledId)) return false;
    const match = serverRows.find((m) =>
      !claimed.has(m.id)
      && m.sender_id === p.senderId
      && m.body === p.body
      && Date.parse(m.created_at) >= Date.parse(p.createdAt) - 1000,
    );
    if (match) { claimed.add(match.id); return false; }
    return true;
  });
}
