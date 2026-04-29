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
  invite_code?: string;
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

/** Join a family by invite code (after migration 004). */
export function useJoinFamily() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!userId) throw new Error('Not authenticated');
      const code = inviteCode.trim().toUpperCase();
      const { data: family, error: gErr } = await supabase
        .from('families')
        .select('id, name')
        .eq('invite_code', code)
        .maybeSingle();
      if (gErr) throw gErr;
      if (!family) throw new Error('Invalid invite code');

      const { error } = await supabase
        .from('family_members')
        .insert({
          family_id: family.id,
          // profile_id defaults to auth.uid() server-side
          relationship_label: 'family',
          status: 'active',
          joined_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
      return family as { id: string; name: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
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
// ── Network stats (RPC from migration 003) ──────────────────────────────
export function useMyNetworkStats() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['network-stats', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_network_stats');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return { reachable_profiles: 0, reachable_families: 0, direct_family_count: 0 };
      return {
        reachable_profiles: Number(row.reachable_profiles ?? 0),
        reachable_families: Number(row.reachable_families ?? 0),
        direct_family_count: Number(row.direct_family_count ?? 0),
      };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * The list of profiles the current user can tag in a post — i.e. everyone
 * reachable through their family graph (≤3 hops), excluding themselves
 * and anyone they've blocked. Used by the New Post composer's tag picker.
 */
export function useMyConnections() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-connections', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Step 1: get reachable profile IDs from the family network reach RPC.
      const { data: reach, error: rErr } = await supabase
        .rpc('family_network_reach', { viewer: userId, max_depth: 3 });
      if (rErr) throw rErr;

      const ids = (reach ?? [])
        .map((r: any) => r.profile_id as string)
        .filter((id: string) => id !== userId);

      if (ids.length === 0) return [];

      // Step 2: hydrate profile rows.
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, handle, display_name, avatar_path')
        .in('id', ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as Array<{
        id: string;
        handle: string | null;
        display_name: string | null;
        avatar_path: string | null;
      }>;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Update the viewer's stature (and inferred generation) within a single
 * family. RLS lets a user update their own `family_members` row via the
 * `fm_self_respond` policy from migration 001.
 *
 * Generation is derived from the stature so the user only has to pick
 * the role and we figure out where on the tree they sit:
 *   matriarch / patriarch / elder  → generation 2
 *   parent / guardian              → generation 1
 *   sibling / offspring / child    → generation 0
 */
export type FamilyStature =
  | 'matriarch' | 'patriarch' | 'elder' | 'parent'
  | 'guardian' | 'sibling' | 'offspring' | 'child';

const GENERATION_BY_STATURE: Record<FamilyStature, number> = {
  matriarch: 2, patriarch: 2, elder: 2,
  parent: 1, guardian: 1,
  sibling: 0, offspring: 0, child: 0,
};

export const STATURE_LABELS: Record<FamilyStature, string> = {
  matriarch: 'Matriarch',
  patriarch: 'Patriarch',
  elder: 'Elder',
  parent: 'Parent',
  guardian: 'Guardian',
  sibling: 'Sibling',
  offspring: 'Adult child',
  child: 'Child',
};

export function useUpdateMyStature() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: { familyId: string; stature: FamilyStature }) => {
      if (!userId) throw new Error('Not signed in');
      const generation = GENERATION_BY_STATURE[input.stature];
      const { error } = await supabase
        .from('family_members')
        .update({ stature: input.stature, generation })
        .eq('family_id', input.familyId)
        .eq('profile_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['family-members'] });
      qc.invalidateQueries({ queryKey: ['stature-summary'] });
    },
  });
}

/**
 * Returns the viewer's current stature in each family they're in.
 * Used by the profile-hub stature picker so the row preselects the
 * value the user already has.
 */
export function useMyStatures() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-statures', userId],
    queryFn: async (): Promise<Record<string, FamilyStature | null>> => {
      if (!userId) return {};
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id, stature')
        .eq('profile_id', userId)
        .eq('status', 'active');
      if (error) throw error;
      const out: Record<string, FamilyStature | null> = {};
      for (const r of data ?? []) out[r.family_id] = (r.stature ?? null) as FamilyStature | null;
      return out;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

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
