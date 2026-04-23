import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type FamilyRole = 'owner' | 'admin' | 'editor' | 'member' | 'medical_limited';

export interface FamilyGroup {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  invite_code: string | null;
  created_at: string;
}

export interface FamilyMembership {
  id: string;
  family_group_id: string;
  user_id: string;
  role: FamilyRole;
  created_at: string;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function useFamilyGroups() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['candon-family-groups', userId],
    queryFn: async () => {
      // Get all groups the user is a member of
      const { data: memberships, error: mErr } = await supabase
        .from('candon_family_memberships')
        .select('family_group_id, role')
        .eq('user_id', userId);
      if (mErr) throw mErr;
      if (!memberships || memberships.length === 0) return [];

      const ids = memberships.map((m: any) => m.family_group_id);
      const { data, error } = await supabase
        .from('candon_family_groups')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Attach role to each group
      const roleMap = new Map(memberships.map((m: any) => [m.family_group_id, m.role]));
      return (data ?? []).map((g: any) => ({ ...g, role: roleMap.get(g.id) })) as (FamilyGroup & { role: FamilyRole })[];
    },
    enabled: !!userId,
  });
}

export function useFamilyGroup(id: string | null) {
  return useQuery({
    queryKey: ['candon-family-group', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('candon_family_groups')
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
    queryKey: ['candon-family-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from('candon_family_memberships')
        .select('*')
        .eq('family_group_id', groupId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMembership[];
    },
    enabled: !!groupId,
  });
}

export function useCreateFamilyGroup() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('candon_family_groups')
        .insert({
          owner_user_id: userId,
          name,
          description: description ?? null,
          invite_code: generateInviteCode(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as FamilyGroup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-family-groups'] });
    },
  });
}

export function useJoinFamilyGroup() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!userId) throw new Error('Not authenticated');
      // Look up the group by invite code
      const { data: group, error: gErr } = await supabase
        .from('candon_family_groups')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();
      if (gErr || !group) throw new Error('Invalid invite code');

      // Add membership
      const { error } = await supabase.from('candon_family_memberships').insert({
        family_group_id: group.id,
        user_id: userId,
        role: 'member',
      });
      if (error) throw error;
      return group;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-family-groups'] });
    },
  });
}

export function useLeaveFamilyGroup() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (groupId: string) => {
      if (!userId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('candon_family_memberships')
        .delete()
        .eq('family_group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-family-groups'] });
    },
  });
}
