/**
 * useStartVideoCall — create a new video call session and return its id.
 * Source-of-Truth-style mutation that the family page button calls
 * before navigating to /call/{id}.
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export function useStartVideoCall() {
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    // A call belongs to exactly one scope: a family (legacy) or a
    // message thread (migration 074). Pass one, never both.
    mutationFn: async (input: { familyId?: string; threadId?: string; label?: string }): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      if (!input.familyId && !input.threadId) throw new Error('The call needs a place to happen.');
      const row: Record<string, unknown> = {
        host_id: userId,
        label: input.label ?? null,
      };
      if (input.threadId) row.thread_id = input.threadId;
      else row.family_id = input.familyId;
      const { data, error } = await supabase
        .from('video_calls')
        .insert(row as any)
        .select('id')
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
  });
}

export function useEndVideoCall() {
  return useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from('video_calls')
        .update({ ended_at: new Date().toISOString() } as any)
        .eq('id', callId)
        .is('ended_at', null);
      if (error) throw error;
    },
  });
}

export function useActiveFamilyCall(familyId: string | null | undefined) {
  // Returns the most recent unended call for the family, if any. Used
  // to render a "Join the call in progress" pill in the family chat.
  return useMutation({
    mutationFn: async () => {
      if (!familyId) return null;
      const { data } = await supabase
        .from('video_calls')
        .select('id, started_at, host_id')
        .eq('family_id', familyId)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
}
