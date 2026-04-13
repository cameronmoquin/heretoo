import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { usePulseStore, type VoteType } from '../stores/pulseStore';
import { useAuthStore } from '../stores/authStore';
import { recordPulseVoteForVerification } from '../lib/verification';

export function usePulseTopics() {
  return useQuery({
    queryKey: ['pulse-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pulse_topics')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePulseStatements(topicId: string) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['pulse-statements', topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pulse_statements')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!topicId,
  });
}

export function usePulseVote() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      statementId,
      vote,
    }: {
      statementId: string;
      vote: VoteType;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('pulse_votes')
        .upsert(
          { statement_id: statementId, user_id: userId, vote },
          { onConflict: 'statement_id,user_id' }
        )
        .select()
        .single();
      if (error) throw error;

      // Update statement counts via RPC or refetch
      // For MVP, we refetch
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['pulse-statements'],
      });
      // Record vote for behavioral verification (unlocks posting after 5 votes)
      if (userId) {
        recordPulseVoteForVerification(userId);
        queryClient.invalidateQueries({
          queryKey: ['verification-status', userId],
        });
      }
    },
  });
}

export function usePulseRealtime(topicId: string) {
  const { updateStatement, setActiveVoterCount } = usePulseStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!topicId) return;

    const channel = supabase
      .channel(`pulse:${topicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pulse_votes',
        },
        () => {
          // Refetch statements to get updated counts
          queryClient.invalidateQueries({
            queryKey: ['pulse-statements', topicId],
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pulse_statements',
          filter: `topic_id=eq.${topicId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['pulse-statements', topicId],
          });
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setActiveVoterCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: 'anonymous' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topicId]);
}

export function useSubmitStatement() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      topicId,
      text,
    }: {
      topicId: string;
      text: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('pulse_statements')
        .insert({
          topic_id: topicId,
          text,
          submitted_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pulse-statements'] });
    },
  });
}
