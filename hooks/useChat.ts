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
export function useThreads() {
  const userId = useAuthStore((s) => s.user?.id);
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
        () => qc.invalidateQueries({ queryKey: ['thread-messages', threadId] }),
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
