import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { MOCK_BRIDGE_SESSIONS, MOCK_BRIDGE_MESSAGES, MOCK_BRIDGE_PROMPTS } from '../lib/mock-data';
import { useAuthStore } from '../stores/authStore';

export interface BridgeSession {
  id: string;
  user_a_id: string;
  user_b_id: string;
  topic_id: string;
  status: 'pending' | 'active' | 'completed' | 'declined';
  match_score: number;
  prompt_sequence: BridgePrompt[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  partner?: {
    display_name: string | null;
    avatar_url: string | null;
    cluster_id: number;
    birth_year: number | null;
  };
  topic?: {
    title: string;
  };
}

export interface BridgeMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  prompt_id: string | null;
  created_at: string;
}

export interface BridgePrompt {
  id: string;
  text: string;
  order: number;
}

export function useBridgeSessions() {
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  return useQuery({
    queryKey: ['bridge-sessions', userId],
    queryFn: async () => {
      if (DEV_MODE) return MOCK_BRIDGE_SESSIONS;

      const { data, error } = await supabase
        .from('bridge_sessions')
        .select(`*, topic:pulse_topics!topic_id(title)`)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      const sessions = data as any[];
      const partnerIds = sessions.map((s) =>
        s.user_a_id === userId ? s.user_b_id : s.user_a_id
      );

      if (partnerIds.length > 0) {
        const { data: partners } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, cluster_id, birth_year')
          .in('id', partnerIds);

        const partnerMap = new Map(
          (partners ?? []).map((p: any) => [p.id, p])
        );

        return sessions.map((s) => ({
          ...s,
          partner: partnerMap.get(
            s.user_a_id === userId ? s.user_b_id : s.user_a_id
          ),
        })) as BridgeSession[];
      }

      return sessions as BridgeSession[];
    },
    enabled: !!userId,
  });
}

export function useBridgeMessages(sessionId: string) {
  return useQuery({
    queryKey: ['bridge-messages', sessionId],
    queryFn: async () => {
      if (DEV_MODE) return MOCK_BRIDGE_MESSAGES[sessionId] ?? [];

      const { data, error } = await supabase
        .from('bridge_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BridgeMessage[];
    },
    enabled: !!sessionId,
  });
}

export function useBridgeRealtime(sessionId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId || DEV_MODE) return;

    const channel = supabase
      .channel(`bridge:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bridge_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['bridge-messages', sessionId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);
}

export function useSendBridgeMessage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  return useMutation({
    mutationFn: async ({
      sessionId,
      content,
      promptId,
    }: {
      sessionId: string;
      content: string;
      promptId?: string;
    }) => {
      if (DEV_MODE) {
        const msg: BridgeMessage = {
          id: `msg-dev-${Date.now()}`,
          session_id: sessionId,
          sender_id: userId,
          content,
          prompt_id: promptId ?? null,
          created_at: new Date().toISOString(),
        };
        // Add to mock data in memory
        if (!MOCK_BRIDGE_MESSAGES[sessionId]) {
          MOCK_BRIDGE_MESSAGES[sessionId] = [];
        }
        MOCK_BRIDGE_MESSAGES[sessionId].push(msg);
        return msg;
      }

      const { data, error } = await supabase
        .from('bridge_messages')
        .insert({
          session_id: sessionId,
          sender_id: userId,
          content,
          prompt_id: promptId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['bridge-messages', variables.sessionId],
      });
    },
  });
}

export function useFindBridgeMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (DEV_MODE) {
        return { match: MOCK_BRIDGE_SESSIONS[1] };
      }

      const { data, error } = await supabase.functions.invoke('match-bridge-users');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] });
    },
  });
}

export function useRespondToMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      accept,
    }: {
      sessionId: string;
      accept: boolean;
    }) => {
      if (DEV_MODE) {
        return { id: sessionId, status: accept ? 'active' : 'declined' };
      }

      const { data, error } = await supabase
        .from('bridge_sessions')
        .update({
          status: accept ? 'active' : 'declined',
          started_at: accept ? new Date().toISOString() : null,
        })
        .eq('id', sessionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bridge-sessions'] });
    },
  });
}
