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

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type ThreadStatus = 'open' | 'pending' | 'declined';

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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, userId]);
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
  });

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`thread:${threadId}`)
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, qc]);

  return query;
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
    // Drop a placeholder into the thread cache the instant the user
    // taps Send — the real message replaces it on round-trip success.
    // Without this the bubble doesn't appear until either (a) the
    // mutation completes AND the query re-fetches, or (b) the next
    // message arrives via realtime. Slow on bad WiFi, surprising for
    // the sender.
    onMutate: async (vars) => {
      if (!userId) return { undo: () => {} };
      const key = ['thread-messages', vars.threadId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChatMessage[]>(key) ?? [];
      const tempId = `optimistic-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        thread_id: vars.threadId,
        sender_id: userId,
        body: vars.body,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<ChatMessage[]>(key, [...prev, optimistic]);
      return { undo: () => qc.setQueryData(key, prev), tempId };
    },
    onError: (_err, vars, context: any) => {
      if (context?.undo) try { context.undo(); } catch {}
    },
    onSuccess: (msg, vars, context: any) => {
      // Replace the temp row with the real one in-place so the bubble
      // doesn't visibly re-render and shift around.
      const key = ['thread-messages', vars.threadId];
      const tempId = context?.tempId;
      qc.setQueryData<ChatMessage[]>(key, (cur) => {
        if (!cur) return [msg];
        const swapped = cur.map((m) => (m.id === tempId ? msg : m));
        // De-dup in case realtime already delivered the real one.
        const seen = new Set<string>();
        return swapped.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
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
