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
  parent_family_group_id?: string | null;
  spawned_by_user_id?: string | null;
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
    mutationFn: async ({
      name,
      description,
      parent_family_group_id,
    }: { name: string; description?: string; parent_family_group_id?: string | null }) => {
      if (!userId) throw new Error('Not authenticated');
      const row: Record<string, unknown> = {
        owner_user_id: userId,
        name,
        description: description ?? null,
        invite_code: generateInviteCode(),
      };
      // Only set the parent + spawner columns if explicitly provided. This
      // keeps inserts working pre-migration-020. With 020 applied, the RLS
      // check requires the creator to be a member of the parent group.
      if (parent_family_group_id) {
        row.parent_family_group_id = parent_family_group_id;
        row.spawned_by_user_id = userId;
      }
      const { data, error } = await supabase
        .from('candon_family_groups')
        .insert(row)
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

// ─── NETWORK STATS (non-private aggregate, exposed on the main HereToo feed) ───
export interface CandonNetworkStats {
  total_families: number;
  total_root_trees: number;
  total_members: number;
  largest_tree_size: number;
  deepest_tree_depth: number;
  families_last_7d: number;
}

export function useCandonNetworkStats() {
  return useQuery({
    queryKey: ['candon-network-stats'],
    queryFn: async (): Promise<CandonNetworkStats | null> => {
      const { data, error } = await supabase.rpc('get_candon_network_stats');
      if (error) {
        // Pre-migration-020: RPC won't exist — fail soft so the feed still loads.
        // eslint-disable-next-line no-console
        console.warn('[network-stats] RPC unavailable:', error.message);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        total_families: Number(row.total_families ?? 0),
        total_root_trees: Number(row.total_root_trees ?? 0),
        total_members: Number(row.total_members ?? 0),
        largest_tree_size: Number(row.largest_tree_size ?? 0),
        deepest_tree_depth: Number(row.deepest_tree_depth ?? 0),
        families_last_7d: Number(row.families_last_7d ?? 0),
      };
    },
    staleTime: 60_000, // a minute is fine for aggregate stats
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
