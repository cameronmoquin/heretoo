/**
 * Family groups + family-scoped posts.
 *
 * Branched from the working public feed. The `posts` table is reused with
 * a new optional `family_group_id` column. RLS handles visibility — public
 * code paths are untouched.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Post } from '../stores/feedStore';

// ═════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════

export type FamilyRole = 'owner' | 'admin' | 'member';
export type FamilyCategory = 'general' | 'medical' | 'holiday' | 'party' | 'event';

export interface FamilyGroup {
  id: string;
  name: string;
  description: string | null;
  motto: string | null;
  theme_primary: string | null;
  invite_code: string;
  created_by: string;
  parent_group_id: string | null;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_group_id: string;
  user_id: string;
  role: FamilyRole;
  joined_at: string;
}

export interface FamilyPost extends Post {
  family_group_id: string;
  family_category: FamilyCategory | null;
}

// ═════════════════════════════════════════════════════════════════════════
// GROUPS
// ═════════════════════════════════════════════════════════════════════════

/** All family groups the current user belongs to. */
export function useFamilyGroups() {
  return useQuery({
    queryKey: ['family-groups'],
    queryFn: async (): Promise<(FamilyGroup & { role: FamilyRole })[]> => {
      const { data: memberships, error: mErr } = await supabase
        .from('family_members')
        .select('family_group_id, role');
      if (mErr) throw mErr;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m: any) => m.family_group_id);
      const { data: groups, error } = await supabase
        .from('family_groups')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const roleMap = new Map(memberships.map((m: any) => [m.family_group_id, m.role]));
      return (groups ?? []).map((g: any) => ({ ...g, role: roleMap.get(g.id) as FamilyRole }));
    },
  });
}

export function useFamilyGroup(id: string | null) {
  return useQuery({
    queryKey: ['family-group', id],
    queryFn: async (): Promise<FamilyGroup | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as FamilyGroup;
    },
    enabled: !!id,
  });
}

export function useFamilyMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['family-members', groupId],
    queryFn: async (): Promise<FamilyMember[]> => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_group_id', groupId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMember[];
    },
    enabled: !!groupId,
  });
}

export function useCreateFamilyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; parent_group_id?: string | null }) => {
      // We do NOT send created_by — the column has a default of auth.uid(),
      // and the trigger inserts the owner membership row automatically.
      const row: Record<string, unknown> = { name: input.name };
      if (input.description) row.description = input.description;
      if (input.parent_group_id) row.parent_group_id = input.parent_group_id;

      const { data, error } = await supabase
        .from('family_groups')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data as FamilyGroup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-groups'] });
    },
  });
}

export function useJoinFamilyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      const code = inviteCode.trim().toUpperCase();
      const { data: group, error: gErr } = await supabase
        .from('family_groups')
        .select('id')
        .eq('invite_code', code)
        .maybeSingle();
      if (gErr) throw gErr;
      if (!group) throw new Error('Invalid invite code');

      // Membership insert defaults user_id to auth.uid().
      const { error } = await supabase
        .from('family_members')
        .insert({ family_group_id: group.id });
      if (error) throw error;
      return group as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-groups'] });
    },
  });
}

export function useLeaveFamilyGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      // RLS allows deleting your own row.
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('family_group_id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-groups'] });
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════
// FAMILY-SCOPED FEED (reuses `posts` with family_group_id filter)
// ═════════════════════════════════════════════════════════════════════════

export function useFamilyFeed(
  groupId: string | null,
  category: FamilyCategory | 'all' = 'all',
) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['family-feed', groupId, category],
    queryFn: async (): Promise<FamilyPost[]> => {
      if (!groupId) return [];
      let q = supabase
        .from('posts')
        .select('*, author:profiles!author_id(username, display_name, avatar_url, cluster_id)')
        .eq('family_group_id', groupId);
      if (category !== 'all') q = q.eq('family_category', category);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FamilyPost[];
    },
    enabled: !!groupId,
  });

  // Realtime: refetch on any new post in this group
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`family-posts:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `family_group_id=eq.${groupId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['family-feed', groupId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, qc]);

  return query;
}
