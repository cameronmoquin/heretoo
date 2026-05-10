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
    mutationFn: async (input: { familyId: string; label?: string }): Promise<string> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('video_calls')
        .insert({
          family_id: input.familyId,
          host_id: userId,
          label: input.label ?? null,
        } as any)
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
