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
    // Drop a placeholder family into the list cache immediately so it
    // appears in /family before the network round-trip + refetch
    // completes. The real row replaces it on success; on error we
    // roll the placeholder back.
    onMutate: async (input) => {
      if (!userId) return { undo: () => {} };
      const key = ['families', userId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any[]>(key) ?? [];
      const tempId = `optimistic-${Date.now()}`;
      const placeholder = {
        id: tempId,
        owner_id: userId,
        name: input.name,
        description: input.description ?? null,
        cover_path: null,
        is_private: false,
        invite_code: null,
        created_at: new Date().toISOString(),
        my_role: 'owner',
        _optimistic: true,
      };
      qc.setQueryData<any[]>(key, [placeholder, ...prev]);
      return { undo: () => qc.setQueryData(key, prev), tempId, key };
    },
    onError: (_err, _vars, context: any) => {
      if (context?.undo) try { context.undo(); } catch {}
    },
    onSuccess: (real, _vars, context: any) => {
      // Swap the temp row for the real one in-place so the list
      // doesn't visibly re-shuffle after a brief delay.
      const key = context?.key ?? ['families', userId];
      qc.setQueryData<any[]>(key, (cur) => {
        if (!cur) return [{ ...real, my_role: 'owner' }];
        return cur.map((f) => (f.id === context?.tempId ? { ...real, my_role: 'owner' } : f));
      });
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['network-stats'] });
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

// ── Delete a family (only allowed when the owner is the sole member) ──
export function useDeleteFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (familyId: string) => {
      const { error } = await supabase
        .from('families')
        .delete()
        .eq('id', familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['network-stats'] });
    },
  });
}

// ── Collective-vote rename (migration 010) ────────────────────────────
export interface RenameProposal {
  id: string;
  family_id: string;
  proposed_name: string;
  proposed_by: string;
  status: 'pending' | 'passed' | 'failed' | 'cancelled';
  resolved_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface RenameVote {
  proposal_id: string;
  voter_id: string;
  vote: boolean;
  created_at: string;
}

/**
 * The currently-pending rename proposal for a family, if any. Each
 * family can only have one pending at a time (enforced by partial
 * unique index in the migration).
 */
export function usePendingRename(familyId: string | null) {
  return useQuery({
    queryKey: ['pending-rename', familyId],
    queryFn: async (): Promise<{ proposal: RenameProposal | null; votes: RenameVote[] } | null> => {
      if (!familyId) return null;
      const { data: proposal, error } = await supabase
        .from('family_rename_proposals')
        .select('*')
        .eq('family_id', familyId)
        .eq('status', 'pending')
        .maybeSingle();
      if (error) throw error;
      if (!proposal) return { proposal: null, votes: [] };

      const { data: votes, error: vErr } = await supabase
        .from('family_rename_votes')
        .select('*')
        .eq('proposal_id', proposal.id);
      if (vErr) throw vErr;

      return {
        proposal: proposal as RenameProposal,
        votes: (votes ?? []) as RenameVote[],
      };
    },
    enabled: !!familyId,
    staleTime: 10_000,
  });
}

export function useProposeRename() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { familyId: string; newName: string }) => {
      const { error } = await supabase.rpc('propose_family_rename', {
        p_family_id: input.familyId,
        p_new_name: input.newName,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-rename', vars.familyId] });
      qc.invalidateQueries({ queryKey: ['family', vars.familyId] });
      qc.invalidateQueries({ queryKey: ['families'] });
    },
  });
}

export function useVoteRename() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proposalId: string; vote: boolean; familyId: string }) => {
      const { error } = await supabase.rpc('vote_family_rename', {
        p_proposal_id: input.proposalId,
        p_vote: input.vote,
      });
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ['pending-rename', vars.familyId] });
      qc.invalidateQueries({ queryKey: ['family', vars.familyId] });
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
    // Optimistic: write the new stature into the my-statures cache and
    // the per-profile stature-summary cache *before* the request lands
    // so the UI updates the moment the user taps a role.
    onMutate: async (input) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ['my-statures', userId] });
      await qc.cancelQueries({ queryKey: ['stature-summary', userId] });

      const prevStatures = qc.getQueryData<Record<string, FamilyStature | null>>(['my-statures', userId]);
      const prevSummary = qc.getQueryData<any>(['stature-summary', userId]);

      qc.setQueryData(['my-statures', userId], (old: any) => ({
        ...(old ?? {}),
        [input.familyId]: input.stature,
      }));
      // Recompute summary's stature optimistically: the highest stature
      // across all the user's families, by enum order.
      const order: FamilyStature[] = [
        'matriarch', 'patriarch', 'elder', 'parent',
        'guardian', 'sibling', 'offspring', 'child',
      ];
      const merged: Record<string, FamilyStature | null> = {
        ...(prevStatures ?? {}),
        [input.familyId]: input.stature,
      };
      const ranks = Object.values(merged).filter(Boolean) as FamilyStature[];
      const top = order.find((o) => ranks.includes(o)) ?? null;
      qc.setQueryData(['stature-summary', userId], (old: any) => ({
        stature: top,
        generation: Math.max(GENERATION_BY_STATURE[input.stature], old?.generation ?? 0),
        network_reach: old?.network_reach ?? 0,
      }));

      return { prevStatures, prevSummary };
    },
    onError: (_err, _vars, ctx: any) => {
      if (!userId || !ctx) return;
      qc.setQueryData(['my-statures', userId], ctx.prevStatures);
      qc.setQueryData(['stature-summary', userId], ctx.prevSummary);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['family-members'] });
      qc.invalidateQueries({ queryKey: ['my-statures'] });
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
        .eq('kind', 'post')               // updates have their own tab
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
        () => {
          qc.invalidateQueries({ queryKey: ['family-feed', familyId] });
          qc.invalidateQueries({ queryKey: ['family-updates', familyId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [familyId, qc]);

  return query;
}

/**
 * Family updates feed — only posts marked kind='update'. The original
 * use case for HereToo: keep time-sensitive family news (medical
 * updates, milestones, the brother in the hospital) in their own
 * dedicated, easy-to-find lane instead of buried in daily chatter.
 */
export function useFamilyUpdates(familyId: string | null) {
  return useQuery({
    queryKey: ['family-updates', familyId],
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from('posts')
        .select(
          '*, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)',
        )
        .eq('family_id', familyId)
        .eq('visibility', 'family')
        .eq('kind', 'update')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!familyId,
  });
}
