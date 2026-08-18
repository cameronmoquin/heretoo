/**
 * Direct-message threads + messages.
 *
 * Two flows:
 *   - In-network (≤3 hops on the family graph): start a thread, send
 *     freely. Status = 'open'.
 *   - Out-of-network (>3 hops): start a thread, send ONE intro message,
 *     status = 'pending' until the recipient accepts.
 *
 * The recipient's UI shows pending threads in a "Requests" pill so they
 * never miss them but they also don't crowd the main thread list.
 *
 * Realtime: each thread query subscribes to its own channel for
 * postgres_changes on `messages` filtered by thread_id, so new
 * messages stream in without polling.
 */

import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { usePendingMessages, pendingFor, unsettled, matchRows } from '../stores/pendingMessages';

export type ThreadStatus = 'open' | 'pending' | 'declined';

/**
 * How long a retired bubble keeps its entry before it is thrown away.
 *
 * Long enough to outlast any refetch that was already in the air when
 * the message committed, since such a refetch resolves without the new
 * row and would otherwise erase a message nothing could redraw.
 */
const RETIRE_GRACE_MS = 15_000;

export interface MessageThread {
  id: string;
  participant_a: string;
  participant_b: string;
  initiator_id: string | null;
  status: ThreadStatus;
  last_message_at: string | null;
  created_at: string;
  // Hydrated client-side from the participant lookup:
  other?: {
    id: string;
    handle: string | null;
    display_name: string | null;
    avatar_path: string | null;
  };
  // Last message preview:
  preview?: { body: string; sender_id: string; created_at: string } | null;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  /** Drawn from the pending store, not yet acknowledged by the server. */
  pending?: boolean;
}

// ── Threads list ───────────────────────────────────────────────────────

/**
 * All threads the viewer is in, with the other party hydrated and a
 * last-message preview. `status` is exposed so the UI can split into
 * "Open" vs "Requests" sections.
 */
/**
 * Total unread message count across all threads the viewer is in.
 * Drives the badge on the Messages tab in the bottom nav. Kept light:
 * a single SQL query, refreshed on a 30s stale interval (and on focus).
 */
export function useUnreadCount() {
  const userId = useAuthStore((s) => s.user?.id);
  // The badge is mounted globally (sidebar, mobile tab bar), so hooking
  // the inbox subscription here is what makes a message land wherever
  // you happen to be standing rather than only on the messages screen.
  useInboxRealtime();
  return useQuery({
    queryKey: ['unread-count', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      // Only count messages where:
      //   - sender is NOT the viewer (own messages aren't "unread")
      //   - read_at is null (not yet marked)
      //   - thread is one the viewer participates in
      const { data: threads } = await supabase
        .from('message_threads')
        .select('id')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`);
      const ids = (threads ?? []).map((t: any) => t.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('thread_id', ids)
        .neq('sender_id', userId)
        .is('read_at', null);
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Realtime for the INBOX, not for one thread.
 *
 * The only channel in this file lived inside useThreadMessages, gated on
 * a threadId — so it existed only while a conversation was open. Sitting
 * on the message list, or anywhere else in the app, nothing was
 * listening at all: a message could not reach the inbox row or the
 * unread badge until something happened to refetch them.
 *
 * No thread_id filter here on purpose. RLS already limits `messages` to
 * threads the viewer is in, so an unfiltered subscription still only
 * delivers their own. Self-sent inserts are ignored — the sender's own
 * cache is already correct from the optimistic write, and refetching on
 * it would fight the optimism this hook exists to preserve.
 */
export function useInboxRealtime() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload?.new?.sender_id === userId) return;
          qc.invalidateQueries({ queryKey: ['threads'] });
          qc.invalidateQueries({ queryKey: ['unread-count'] });
          qc.invalidateQueries({ queryKey: ['thread-messages', payload?.new?.thread_id] });
        },
      )
      // postgres_changes does NOT replay what happened while the socket
      // was down, and a phone's socket goes down every time the screen
      // locks. Each (re)join therefore refetches everything this channel
      // covers — the rejoin itself is the "you may have missed
      // something" signal.
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          qc.invalidateQueries({ queryKey: ['threads'] });
          qc.invalidateQueries({ queryKey: ['unread-count'] });
          qc.invalidateQueries({ queryKey: ['thread-messages'] });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);
}

/**
 * Ask the push endpoint to notify this message's recipient.
 *
 * The endpoint takes only a message id and verifies from the caller's
 * JWT that the message is theirs, so nothing here can aim a
 * notification at someone else or choose what it says.
 */
async function notifyPush(messageId: string | undefined): Promise<void> {
  if (!messageId) return;
  try {
    const { data } = await supabase.auth.getSession();
    const jwt = data?.session?.access_token;
    if (!jwt) return;
    // Platform.OS, not `typeof window`. React Native aliases window to global,
    // so that check passes on a phone — but RN ships no window.location, and
    // reading .origin off undefined throws a TypeError straight into the catch
    // below, where it looks like nothing happened.
    //
    // The effect was that push worked in a browser and silently did nothing on
    // the Jude-a-phone: every message he sent notified no one, with no error
    // anywhere to say so.
    const base =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.location
        ? window.location.origin
        : 'https://heretoo.social';
    await fetch(`${base}/.netlify/functions/push-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ messageId }),
    });
  } catch (e) {
    // The message is sent and saved. A failed push is not a failed send — but
    // it is not nothing either. Swallowing this silently is what let a
    // TypeError on window.location hide for as long as it did.
    // eslint-disable-next-line no-console
    console.warn('[push] notify failed:', e);
  }
}

export function useThreads() {
  const userId = useAuthStore((s) => s.user?.id);
  useInboxRealtime();
  return useQuery({
    queryKey: ['threads', userId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!userId) return [];
      const { data: threads, error } = await supabase
        .from('message_threads')
        .select('*')
        .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const list = (threads ?? []) as MessageThread[];

      // Resolve "the other person" + a last message preview per thread.
      const otherIds = list.map((t) =>
        t.participant_a === userId ? t.participant_b : t.participant_a,
      );
      const profileMap = new Map<string, MessageThread['other']>();
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, handle, display_name, avatar_path')
          .in('id', otherIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p as any);
      }

      // Last message previews (one round-trip each is fine for now).
      // Could be a single window-function query if it gets slow.
      const previews = await Promise.all(
        list.map(async (t) => {
          const { data: msg } = await supabase
            .from('messages')
            .select('body, sender_id, created_at')
            .eq('thread_id', t.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return msg ?? null;
        }),
      );

      return list.map((t, i) => ({
        ...t,
        other: profileMap.get(
          t.participant_a === userId ? t.participant_b : t.participant_a,
        ),
        preview: previews[i] as MessageThread['preview'],
      }));
    },
    enabled: !!userId,
    staleTime: 10_000,
  });
}

// ── Messages in a single thread ────────────────────────────────────────

export function useThreadMessages(threadId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['thread-messages', threadId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!threadId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    enabled: !!threadId,
    // The app default is two minutes of freshness, which is exactly the
    // blind window a phone opens every time its screen locks: the
    // socket missed inserts it will never be told about, and the focus
    // refetch declined to run because the cache still looked fresh. An
    // open conversation is never fresh enough to skip.
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });

  useEffect(() => {
    if (!threadId) return;
    // The suffix is load-bearing. supabase-js caches channels by name, so a
    // fixed `thread:<id>` hands back the still-subscribed channel from the
    // previous mount and the .on() below throws
    //   "cannot add `postgres_changes` callbacks for realtime:thread:<id>
    //    after `subscribe()`"
    // which the ErrorBoundary catches as "Something broke."
    //
    // Opening a thread, going back, and opening it again is enough to trigger
    // it — removeChannel() is async, so the old channel is often still cached
    // when the next mount asks for the same name. The inbox subscription above
    // already does this; this one was missed.
    const channel = supabase
      .channel(`thread:${threadId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => {
          // The open thread, plus the two things that describe it from
          // outside. Only the first was refreshed before, so a message
          // arriving left the inbox row and the unread badge stale until
          // something else happened to refetch them.
          qc.invalidateQueries({ queryKey: ['thread-messages', threadId] });
          qc.invalidateQueries({ queryKey: ['threads'] });
          qc.invalidateQueries({ queryKey: ['unread-count'] });
        },
      )
      // Rejoin = refetch. postgres_changes never replays what happened
      // while the socket slept, so the rejoin itself is the "you may
      // have missed something" signal.
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          qc.invalidateQueries({ queryKey: ['thread-messages', threadId] });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc]);

  // Messages in flight, merged over the server's answer. They are stored
  // outside the query cache precisely so the refetches above cannot
  // delete them mid-send; see stores/pendingMessages.ts.
  const byThread = usePendingMessages((s) => s.byThread);
  const retire = usePendingMessages((s) => s.retire);
  const pending = pendingFor(byThread, threadId);

  const live = useMemo(
    () => (pending.length > 0 ? unsettled(pending, query.data ?? []) : pending),
    [pending, query.data],
  );

  // Retirement is a DRAWING decision, recomputed every render. Dropping
  // the entry is a separate, deliberately late step.
  //
  // Deleting the instant a row appeared was wrong twice over. A refetch
  // that started before the INSERT committed can resolve afterwards and
  // replace the array WITHOUT the new row — and with the entry already
  // deleted there was nothing left to draw the bubble again, so the
  // message showed and then disappeared. That is the original bug moved
  // one step later, not fixed. Keeping the entry means `unsettled` sees
  // the row go missing and simply draws it again; it heals both ways.
  //
  // It also fed its own output back in: remove() changed `pending`, which
  // recomputed `live` with a FRESH claim set, so a row that had already
  // retired one bubble was free to retire the next identical one, and a
  // duplicate send lost its second bubble one pass at a time.
  const retiredKey = useMemo(() => {
    if (pending.length === live.length) return '';
    const drawn = new Set(live.map((p) => p.tempId));
    return pending.filter((p) => !drawn.has(p.tempId)).map((p) => p.tempId).join(',');
  }, [pending, live]);

  useEffect(() => {
    if (!threadId || !retiredKey) return;
    const ids = new Set(retiredKey.split(','));
    const t = setTimeout(() => {
      // Re-decided against the cache as it stands NOW, not as it stood
      // when the timer was set. Anything that has gone missing in the
      // meantime keeps its entry and keeps drawing.
      //
      // Matched against the WHOLE list, not just the entries being
      // dropped: the claim bookkeeping only works on the complete set.
      // Each drop then hands its row id to the survivors so the claim
      // does not die with the entry.
      const rows = qc.getQueryData<ChatMessage[]>(['thread-messages', threadId]) ?? [];
      const all = usePendingMessages.getState().byThread[threadId] ?? [];
      const matched = matchRows(all, rows);
      for (const p of all) {
        if (!ids.has(p.tempId)) continue;
        const rowId = matched.get(p.tempId);
        if (rowId) retire(threadId, p.tempId, rowId);
      }
    }, RETIRE_GRACE_MS);
    return () => clearTimeout(t);
  }, [threadId, retiredKey, retire, qc]);

  const data = useMemo(() => {
    const rows = query.data ?? [];
    if (live.length === 0) return rows;
    return [
      ...rows,
      ...live.map((p): ChatMessage => ({
        id: p.tempId,
        thread_id: p.threadId,
        sender_id: p.senderId,
        body: p.body,
        read_at: null,
        created_at: p.createdAt,
        pending: true,
      })),
    ];
  }, [query.data, live]);

  return { ...query, data };
}

export function useThread(threadId: string | null) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      if (!threadId) return null;
      const { data, error } = await supabase
        .from('message_threads')
        .select('*')
        .eq('id', threadId)
        .single();
      if (error) throw error;
      return data as MessageThread;
    },
    enabled: !!threadId,
  });
}

// ── Actions ────────────────────────────────────────────────────────────

/**
 * Open or get a thread between the viewer and `targetProfileId`.
 *
 * 1. Sort the two ids so participant_a < participant_b (matches the
 *    table's CHECK constraint and uniqueness).
 * 2. Look up an existing thread with that pair.
 * 3. If none exists, look up whether the target is in our network
 *    (3-hop reach) via `viewer_is_in_network`. In-network → status
 *    'open'. Out-of-network → status 'pending', initiator = us.
 */
export function useOpenThread() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (targetProfileId: string): Promise<MessageThread> => {
      if (!userId) throw new Error('Not signed in');
      if (targetProfileId === userId) throw new Error("Can't open a thread with yourself");

      const [a, b] = userId < targetProfileId
        ? [userId, targetProfileId]
        : [targetProfileId, userId];

      // Existing?
      const { data: existing, error: lookupErr } = await supabase
        .from('message_threads')
        .select('*')
        .eq('participant_a', a)
        .eq('participant_b', b)
        .maybeSingle();
      if (lookupErr) throw lookupErr;
      if (existing) return existing as MessageThread;

      // Approval gate: in-network → open, out-of-network → pending.
      const { data: inNet } = await supabase.rpc('viewer_is_in_network', { target: targetProfileId });
      const status: ThreadStatus = inNet ? 'open' : 'pending';

      const { data, error } = await supabase
        .from('message_threads')
        .insert({
          participant_a: a,
          participant_b: b,
          status,
          initiator_id: userId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as MessageThread;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { threadId: string; body: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('messages')
        .insert({
          thread_id: input.threadId,
          sender_id: userId,
          body: input.body,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    // The bubble appears on the frame of the tap. NOT AWAITED, and NOT
    // written to the query cache — both of those were the bug.
    //
    // The old version awaited cancelQueries before drawing anything. On a
    // phone there is nearly always a fetch in flight (staleTime 0 plus a
    // focus refetch fired by the keyboard dismissing on send), so that
    // await routinely pushed the bubble a tick or more past the tap: the
    // send felt instant sometimes and laggy other times, depending on
    // whether a refetch happened to be running. Nothing needs cancelling
    // now, because a refetch landing on top of the cache can no longer
    // erase a message that was never in it.
    onMutate: (vars) => {
      if (!userId) return {};
      const key = ['thread-messages', vars.threadId];
      const prev = qc.getQueryData<ChatMessage[]>(key) ?? [];
      // Sort last, even on a phone whose clock disagrees with the
      // server's. A device running a few minutes slow used to file its
      // own new message into the middle of the conversation.
      //
      // The floor has to clear the messages ALREADY IN FLIGHT too, not
      // just the cache. Pending sends are deliberately not in the cache,
      // so two taps inside one round trip both read the same `newest`
      // and both stamped newest+1ms — identical, and their order after
      // that was whatever the sort happened to do.
      const inFlight = usePendingMessages.getState().byThread[vars.threadId] ?? [];
      const newest = Math.max(
        0,
        ...prev.map((m) => Date.parse(m.created_at) || 0),
        ...inFlight.map((p) => Date.parse(p.createdAt) || 0),
      );
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      usePendingMessages.getState().add({
        tempId,
        threadId: vars.threadId,
        senderId: userId,
        body: vars.body,
        createdAt: new Date(Math.max(Date.now(), newest + 1)).toISOString(),
        // What the thread already held. Anything outside this set is new,
        // which is what lets the fuzzy match work without consulting a clock.
        knownIds: new Set(prev.map((m) => m.id)),
      });
      return { tempId };
    },
    onError: (_err, vars, context: any) => {
      if (context?.tempId) usePendingMessages.getState().remove(vars.threadId, context.tempId);
    },
    onSuccess: (msg, vars, context: any) => {
      // Ring the recipient's phone. Fired here rather than from a poll
      // because a notification that lands minutes late is not one.
      // Fire-and-forget: the message is already sent and saved, and a
      // push that fails must never surface as a failed send.
      void notifyPush((msg as any)?.id);

      // The real row goes into the cache; the pending bubble is marked
      // settled rather than deleted. It keeps drawing until this id is
      // provably in the fetched list, so a refetch that started before
      // the INSERT committed and resolves after it cannot blink the
      // message out on its way past.
      const key = ['thread-messages', vars.threadId];
      qc.setQueryData<ChatMessage[]>(key, (cur) => {
        if (!cur) return [msg];
        if (cur.some((m) => m.id === msg.id)) return cur;
        return [...cur, msg];
      });
      if (context?.tempId) {
        usePendingMessages.getState().settle(vars.threadId, context.tempId, msg.id);
      }
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}

/**
 * Mark every inbound (sender ≠ viewer) message in this thread as read.
 *
 * Called by the thread screen as soon as messages render — the user is
 * physically looking at the thread, so by definition the messages are
 * read. Calls a SECURITY DEFINER RPC because the messages UPDATE policy
 * (correctly) only lets the sender modify their own rows.
 *
 * On success we invalidate the badge count + the thread list so the
 * Messages tab badge in the bottom nav drops immediately.
 */
export function useMarkThreadRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { data, error } = await supabase.rpc('mark_thread_read', {
        p_thread_id: threadId,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: (markedCount, threadId) => {
      // Optimistically zero the badge count drop locally too — the
      // refetch below will reconcile, but the badge should respond
      // before the round-trip finishes.
      if (markedCount > 0) {
        qc.setQueryData<number>(['unread-count', userId], (cur) =>
          Math.max(0, (cur ?? 0) - markedCount),
        );
      }
      qc.invalidateQueries({ queryKey: ['unread-count', userId] });
      qc.invalidateQueries({ queryKey: ['thread-messages', threadId] });
      qc.invalidateQueries({ queryKey: ['threads', userId] });
    },
  });
}

/** Recipient accepts a pending request — flips status to 'open'. */
export function useAcceptThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('message_threads')
        .update({ status: 'open' })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: (_v, threadId) => {
      qc.invalidateQueries({ queryKey: ['threads'] });
      qc.invalidateQueries({ queryKey: ['thread', threadId] });
    },
  });
}

/** Recipient declines — flips to 'declined'. Thread becomes silent. */
export function useDeclineThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('message_threads')
        .update({ status: 'declined' })
        .eq('id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
