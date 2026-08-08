/**
 * Founding-seed invites — "plant a tree" with someone outside your
 * existing family network.
 *
 * Sponsor flow: tap "Plant a tree" → optionally write a note + suggest
 * a family name → generate a one-time token → share the link.
 *
 * Recipient flow: open /sow/<TOKEN> → sign up if needed → name their
 * new family → accept. Behind the scenes the RPC creates the family
 * with them as owner AND inserts an accepted `connections` row to the
 * sponsor so the two trees see each other in the network graph.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeedInvitePreview {
  token: string;
  sponsor_id: string;
  sponsor_handle: string | null;
  sponsor_display_name: string | null;
  sponsor_avatar_path: string | null;
  message: string | null;
  suggested_family_name: string | null;
  /** The number (or name) the sender addressed. Becomes the guest's username. */
  guest_handle?: string | null;
  used: boolean;
  expired: boolean;
}

/**
 * Anon-callable: look up a seed invite by token. Returns a preview of
 * the sponsor + the message they wrote so the recipient knows who is
 * inviting them and why.
 */
export function useSeedInvite(token: string | null) {
  return useQuery({
    queryKey: ['seed-invite', token],
    queryFn: async (): Promise<SeedInvitePreview | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc('find_seed_invite', { token_in: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as SeedInvitePreview | null;
    },
    enabled: !!token,
  });
}

export function useCreateSeedInvite() {
  return useMutation({
    mutationFn: async (input: { message?: string; suggestedFamilyName?: string; guestHandle?: string }): Promise<string> => {
      // All three arguments, always. Two create_seed_invite signatures
      // exist server-side (080 added the third argument beside the old
      // pair); a call that omits guest_handle_in matches both and
      // PostgREST refuses to choose. Naming all three matches exactly
      // one.
      const { data, error } = await supabase.rpc('create_seed_invite', {
        message_in: input.message ?? null,
        suggested_family_name_in: input.suggestedFamilyName ?? null,
        guest_handle_in: input.guestHandle ?? null,
      });
      if (error) throw error;
      // RPC returns text directly (the token).
      return String(data);
    },
  });
}

export function useAcceptSeedInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { token: string; familyName?: string }) => {
      const { data, error } = await supabase.rpc('accept_seed_invite', {
        token_in: input.token,
        family_name_in: input.familyName ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { family_id: string; connection_id: string | null };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['network-stats'] });
      qc.invalidateQueries({ queryKey: ['seed-invite'] });
    },
  });
}


/**
 * Guest entry (migration 080): the invitation is a message. Accept
 * names the guest what the sender addressed, connects the pair, and
 * returns the open thread with the sponsor.
 */
export function useAcceptMessageInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<{ thread_id: string; sponsor_id: string }> => {
      const { data, error } = await supabase.rpc('accept_message_invite', { token_in: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { thread_id: string; sponsor_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });
}
