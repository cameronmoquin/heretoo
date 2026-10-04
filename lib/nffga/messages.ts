/**
 * Direct messages: nffga_threads, nffga_thread_members, nffga_messages.
 *
 * Members only (RLS). A thread is started with nffga_start_thread,
 * which reuses an existing 1:1 thread about the same gear listing.
 * The open thread listens on realtime and also polls every 10 s, so it
 * stays current whether or not nffga_messages is in the realtime
 * publication.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Message, Thread } from './types';
import { fetchAuthors, quietRead, quietWarn, writeErrorText } from './profile';

export const MESSAGE_MAX = 4000;

type ThreadRow = Pick<Thread, 'id' | 'subject' | 'gear_listing_id' | 'created_at' | 'last_message_at'>;
type MemberRow = { thread_id: string; user_id: string; last_read_at: string | null };

async function latestMessage(threadId: string): Promise<Message | null> {
  return quietRead<Message | null>(
    'nffga_messages latest',
    () => supabase
      .from('nffga_messages')
      .select('id, thread_id, author_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    null,
  );
}

/** The caller's threads, most recent first, with the other person, a preview and unread. */
export async function listThreads(userId: string): Promise<Thread[]> {
  const mine = await quietRead<MemberRow[]>(
    'nffga_thread_members mine',
    () => supabase.from('nffga_thread_members').select('thread_id, user_id, last_read_at').eq('user_id', userId),
    [],
  );
  if (!mine.length) return [];
  const ids = mine.map((m) => m.thread_id);
  const readAt = new Map(mine.map((m) => [m.thread_id, m.last_read_at]));

  const [threads, others] = await Promise.all([
    quietRead<ThreadRow[]>(
      'nffga_threads list',
      () => supabase.from('nffga_threads').select('id, subject, gear_listing_id, created_at, last_message_at').in('id', ids),
      [],
    ),
    quietRead<MemberRow[]>(
      'nffga_thread_members others',
      () => supabase.from('nffga_thread_members').select('thread_id, user_id, last_read_at').in('thread_id', ids).neq('user_id', userId),
      [],
    ),
  ]);
  const [authors, latest] = await Promise.all([
    fetchAuthors(others.map((o) => o.user_id)),
    Promise.all(threads.map((t) => latestMessage(t.id))),
  ]);
  const otherOf = new Map<string, string>();
  for (const o of others) if (!otherOf.has(o.thread_id)) otherOf.set(o.thread_id, o.user_id);

  const out = threads.map((t, i) => {
    const last = latest[i];
    const lastAt = last?.created_at ?? t.last_message_at ?? t.created_at;
    const read = readAt.get(t.id);
    const otherId = otherOf.get(t.id);
    const unread = !!last && last.author_id !== userId && (!read || new Date(last.created_at) > new Date(read));
    return {
      ...t,
      last_message_at: lastAt,
      other: otherId ? (authors.get(otherId) ?? { user_id: otherId, display_name: 'Member', department: null }) : null,
      last_message: last?.body ?? null,
      unread,
    } as Thread;
  });
  out.sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());
  return out;
}

/** One thread, if the caller is in it. */
export async function getThread(threadId: string, userId: string): Promise<Thread | null> {
  const t = await quietRead<ThreadRow | null>(
    'nffga_threads get',
    () => supabase.from('nffga_threads').select('id, subject, gear_listing_id, created_at, last_message_at').eq('id', threadId).maybeSingle(),
    null,
  );
  if (!t) return null;
  const others = await quietRead<MemberRow[]>(
    'nffga_thread_members others',
    () => supabase.from('nffga_thread_members').select('thread_id, user_id, last_read_at').eq('thread_id', threadId).neq('user_id', userId),
    [],
  );
  const otherId = others[0]?.user_id;
  const authors = await fetchAuthors(otherId ? [otherId] : []);
  return {
    ...t,
    other: otherId ? (authors.get(otherId) ?? { user_id: otherId, display_name: 'Member', department: null }) : null,
  };
}

export async function listMessages(threadId: string): Promise<Message[]> {
  return quietRead<Message[]>(
    'nffga_messages list',
    () => supabase
      .from('nffga_messages')
      .select('id, thread_id, author_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(500),
    [],
  );
}

export async function sendMessage(threadId: string, userId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write something first.' };
  if (text.length > MESSAGE_MAX) return { ok: false, error: `Keep it under ${MESSAGE_MAX} characters.` };
  const { error } = await supabase.from('nffga_messages').insert({ thread_id: threadId, author_id: userId, body: text });
  if (error) return { ok: false, error: writeErrorText(error, 'The message did not send. Try again.') };
  return { ok: true };
}

export async function markThreadRead(threadId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('nffga_mark_thread_read', { p_thread_id: threadId });
    if (error) quietWarn('nffga_mark_thread_read', error);
  } catch (err) {
    quietWarn('nffga_mark_thread_read', err);
  }
}

/** Start (or reuse) a 1:1 thread with `other`, sending `body` as the first message. */
export async function startThread(
  other: string, body: string, gearListingId: string | null = null,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write something first.' };
  if (text.length > MESSAGE_MAX) return { ok: false, error: `Keep it under ${MESSAGE_MAX} characters.` };
  try {
    const { data, error } = await supabase.rpc('nffga_start_thread', {
      p_other: other, p_body: text, p_gear_listing_id: gearListingId,
    });
    if (error) return { ok: false, error: writeErrorText(error, 'The message did not send. Try again.') };
    const res = (data ?? {}) as { ok?: boolean; thread_id?: string; error?: string };
    if (!res.ok || !res.thread_id) {
      return { ok: false, error: res.error === 'self' ? 'You cannot message yourself.' : 'The message did not send. Try again.' };
    }
    return { ok: true, threadId: res.thread_id };
  } catch (err) {
    return { ok: false, error: writeErrorText(err, 'The message did not send. Try again.') };
  }
}

// ── Hooks ───────────────────────────────────────────────────────────

export const inboxKeys = {
  all: ['nffga', 'inbox'] as const,
  threads: (uid: string) => ['nffga', 'inbox', 'threads', uid] as const,
  thread: (id: string) => ['nffga', 'inbox', 'thread', id] as const,
  messages: (id: string) => ['nffga', 'inbox', 'messages', id] as const,
};

export function useThreads(userId: string | null) {
  return useQuery({
    queryKey: inboxKeys.threads(userId ?? ''),
    queryFn: () => listThreads(userId as string),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useThread(threadId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: inboxKeys.thread(threadId ?? ''),
    queryFn: () => getThread(threadId as string, userId as string),
    enabled: !!threadId && !!userId,
  });
}

/** Messages in the open thread: realtime inserts plus a 10 s poll. */
export function useThreadMessages(threadId: string | undefined, enabled: boolean) {
  const qc = useQueryClient();
  const on = !!threadId && enabled;

  useEffect(() => {
    if (!on || !threadId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`nffga-thread-${threadId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'nffga_messages', filter: `thread_id=eq.${threadId}` },
          () => { qc.invalidateQueries({ queryKey: inboxKeys.messages(threadId) }); },
        )
        .subscribe();
    } catch (err) {
      quietWarn('nffga_messages realtime', err);
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [on, threadId, qc]);

  return useQuery({
    queryKey: inboxKeys.messages(threadId ?? ''),
    queryFn: () => listMessages(threadId as string),
    enabled: on,
    refetchInterval: 10_000,
  });
}
