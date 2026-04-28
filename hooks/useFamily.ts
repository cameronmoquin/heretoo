/**
 * Family groups + family-scoped posts (new schema).
 *
 * Tables:
 *   families          - id, owner_id, name, description, cover_path, is_private
 *   family_members    - id, family_id, profile_id, relationship_label, status, joined_at
 *   posts             - has family_id (when visibility='family')
 *
 * Auto-add-owner trigger inserts the creator as an active member on insert.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// ── types ─────────────────────────────────────────────────────────────
export type FamilyMemberStatus = 'pending' | 'active' | 'declined' | 'removed';
export type PostVisibility = 'public' | 'connections' | 'family' | 'private';

export interface Family {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  cover_path: string | null;
  is_private: boolean;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  profile_id: string;
  relationship_label: string;
  invited_by: string | null;
  status: FamilyMemberStatus;
  joined_at: string | null;
  created_at: string;
}

// ── families ──────────────────────────────────────────────────────────
export function useMyFamilies() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['families', userId],
    queryFn: async (): Promise<(Family & { my_role: string })[]> => {
      if (!userId) return [];
      const { data: memberships, error: mErr } = await supabase
        .from('family_members')
        .select('family_id, relationship_label, status')
        .eq('profile_id', userId)
        .eq('status', 'active');
      if (mErr) throw mErr;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m: any) => m.family_id);
      const { data: families, error } = await supabase
        .from('families')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const labelMap = new Map(memberships.map((m: any) => [m.family_id, m.relationship_label]));
      return (families ?? []).map((f: any) => ({
        ...f,
        my_role: labelMap.get(f.id) ?? 'member',
      }));
    },
    enabled: !!userId,
  });
}

export function useFamily(id: string | null) {
  return useQuery({
    queryKey: ['family', id],
    queryFn: async (): Promise<Family | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Family;
    },
    enabled: !!id,
  });
}

export function useFamilyMembers(familyId: string | null) {
  return useQuery({
    queryKey: ['family-members', familyId],
    queryFn: async (): Promise<FamilyMember[]> => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', familyId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
    enabled: !!familyId,
  });
}

export function useCreateFamily() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('families')
        .insert({
          owner_id: userId,
          name: input.name,
          description: input.description ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Family;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
    },
  });
}

/** Join via invite (in this schema there's no invite_code on families;
 * a member is added by an existing member who knows your profile id, OR
 * via a separate invitation flow that's TODO. For now: stub that throws. */
export function useJoinFamily() {
  return useMutation({
    mutationFn: async (_inviteCode: string) => {
      throw new Error(
        'Invitations are not wired yet — ask an existing family member to add you from the family page.',
      );
    },
  });
}

export function useLeaveFamily() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (familyId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('family_id', familyId)
        .eq('profile_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
    },
  });
}

// ── family-scoped feed ────────────────────────────────────────────────
export function useFamilyFeed(familyId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['family-feed', familyId],
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from('posts')
        .select(
          '*, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)',
        )
        .eq('family_id', familyId)
        .eq('visibility', 'family')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!familyId,
  });

  useEffect(() => {
    if (!familyId) return;
    const channel = supabase
      .channel(`family-posts:${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `family_id=eq.${familyId}` },
        () => qc.invalidateQueries({ queryKey: ['family-feed', familyId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId, qc]);

  return query;
}
