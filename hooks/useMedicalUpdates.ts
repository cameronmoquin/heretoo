import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type MedicalStatus =
  | 'stable' | 'monitoring' | 'concerning' | 'critical'
  | 'improving' | 'recovering' | 'passed';

export interface MedicalUpdate {
  id: string;
  family_post_id: string;
  patient_label: string;
  status_level: MedicalStatus;
  care_location: string | null;
  help_needed: string | null;
  contact_person: string | null;
  next_update_expected_at: string | null;
}

export function useMedicalUpdate(postId: string | null) {
  return useQuery({
    queryKey: ['candon-medical', postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from('candon_family_medical_updates')
        .select('*')
        .eq('family_post_id', postId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return (data ?? null) as MedicalUpdate | null;
    },
    enabled: !!postId,
  });
}

// ─── POST RECIPIENTS ───
export function usePostRecipients(postId: string | null) {
  return useQuery({
    queryKey: ['candon-post-recipients', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('candon_family_post_recipients')
        .select('user_id')
        .eq('family_post_id', postId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.user_id) as string[];
    },
    enabled: !!postId,
  });
}

// ─── ACKNOWLEDGEMENTS ───
export function usePostAcks(postId: string | null) {
  return useQuery({
    queryKey: ['candon-post-acks', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('candon_post_acknowledgements')
        .select('*')
        .eq('family_post_id', postId);
      if (error) throw error;
      return data as { id: string; user_id: string; acknowledged_at: string }[];
    },
    enabled: !!postId,
  });
}

export function useAcknowledgePost() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('candon_post_acknowledgements')
        .insert({ family_post_id: postId, user_id: userId });
      // Ignore unique-violation error (already acked)
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: (_d, postId) => {
      qc.invalidateQueries({ queryKey: ['candon-post-acks', postId] });
    },
  });
}

// ─── VIEW AUDIT LOG ───
export async function logPostView(postId: string, userId: string | null | undefined) {
  if (!userId) return;
  try {
    await supabase.from('candon_post_view_log').insert({
      family_post_id: postId,
      user_id: userId,
    });
  } catch {
    // Non-blocking
  }
}

export function usePostViewLog(postId: string | null) {
  return useQuery({
    queryKey: ['candon-view-log', postId],
    queryFn: async () => {
      if (!postId) return [];
      const { data, error } = await supabase
        .from('candon_post_view_log')
        .select('*')
        .eq('family_post_id', postId)
        .order('viewed_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as { id: string; user_id: string; viewed_at: string }[];
    },
    enabled: !!postId,
  });
}
