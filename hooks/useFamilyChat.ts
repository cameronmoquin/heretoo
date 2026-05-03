/**
 * Family group chat hooks.
 *
 * Backed by `family_chats` (one row per family) + `family_chat_messages`
 * (the actual conversation). Lives alongside the 1:1 messaging
 * infrastructure (message_threads + messages) — kept separate so we
 * don't disturb the recursion-fixed RLS policies in migration 015.
 *
 * Three hooks:
 *   - useFamilyChat(familyId)        — get-or-create the family's chat row
 *   - useFamilyChatMessages(chatId)  — full message list, with realtime
 *   - useSendFamilyChatMessage()     — optimistic insert
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface FamilyChatMessage {
  id: string;
  family_chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/**
 * Resolve the chat row for a family. Creates one if it doesn't exist —
 * the family RLS policy + migration 021 ensure only an active member
 * of that family can do this, so the create path is safe.
 */
export function useFamilyChat(familyId: string | null) {
  return useQuery({
    queryKey: ['family-chat', familyId],
    queryFn: async (): Promise<{ id: string } | null> => {
      if (!familyId) return null;
      // Look up first
      const { data: existing, error } = await supabase
        .from('family_chats')
        .select('id')
        .eq('family_id', familyId)
        .maybeSingle();
      if (error) throw error;
      if (existing) return existing as any;

      // Create on first access
      const { data: created, error: createErr } = await supabase
        .from('family_chats')
        .insert({ family_id: familyId })
        .select('id')
        .single();
      if (createErr) throw createErr;
      return created as any;
    },
    enabled: !!familyId,
  });
}

/**
 * Messages in a family chat, oldest first. Subscribes to realtime
 * INSERTs for the chat so new messages stream in without polling.
 */
export function useFamilyChatMessages(chatId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['family-chat-messages', chatId],
    queryFn: async (): Promise<FamilyChatMessage[]> => {
      if (!chatId) return [];
      const { data, error } = await supabase
        .from('family_chat_messages')
        .select('*')
        .eq('family_chat_id', chatId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyChatMessage[];
    },
    enabled: !!chatId,
  });

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`family-chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_chat_messages', filter: `family_chat_id=eq.${chatId}` },
        () => qc.invalidateQueries({ queryKey: ['family-chat-messages', chatId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, qc]);

  return query;
}

/**
 * Send a message to the family chat. Optimistic — placeholder lands
 * in the cache the moment the user taps Send; the real row swaps in
 * on round-trip success. Same pattern as 1:1 chat send.
 */
export function useSendFamilyChatMessage() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { chatId: string; body: string }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('family_chat_messages')
        .insert({
          family_chat_id: input.chatId,
          sender_id: userId,
          body: input.body,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FamilyChatMessage;
    },
    onMutate: async (vars) => {
      if (!userId) return { undo: () => {} };
      const key = ['family-chat-messages', vars.chatId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FamilyChatMessage[]>(key) ?? [];
      const tempId = `optimistic-${Date.now()}`;
      const optimistic: FamilyChatMessage = {
        id: tempId,
        family_chat_id: vars.chatId,
        sender_id: userId,
        body: vars.body,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<FamilyChatMessage[]>(key, [...prev, optimistic]);
      return { undo: () => qc.setQueryData(key, prev), tempId };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.undo) try { context.undo(); } catch {}
    },
    onSuccess: (msg, vars, context: any) => {
      const key = ['family-chat-messages', vars.chatId];
      const tempId = context?.tempId;
      qc.setQueryData<FamilyChatMessage[]>(key, (cur) => {
        if (!cur) return [msg];
        const swapped = cur.map((m) => (m.id === tempId ? msg : m));
        const seen = new Set<string>();
        return swapped.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
    },
  });
}
