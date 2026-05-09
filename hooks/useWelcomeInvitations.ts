/**
 * Welcome invitations — onboarding ceremony scaffolding.
 * Source of Truth, Milestone 9. Schema in 034_welcome_invitations.sql.
 *
 * v1 ships the digital ceremony only:
 *   - Inviter creates a welcome_invitations row, gets a URL.
 *   - Recipient opens /welcome/{token}, hears Bike Messenger greet
 *     them by name, taps "Step inside," and lands in the auth flow
 *     with the family's invite code pre-filled.
 *
 * The Lob print integration (printed welcome card, postage, tracking)
 * is a separate function that reads from the same table.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface WelcomeInvitation {
  token: string;
  inviter_id: string | null;
  recipient_first_name: string;
  recipient_relationship: string | null;
  recipient_address: any;
  card_design: string | null;
  voice_note_url: string | null;
  family_id: string | null;
  shipped_at: string | null;
  claimed_at: string | null;
  claimed_by_user_id: string | null;
  created_at: string;
}

export interface WelcomePublic {
  recipient_first_name: string;
  recipient_relationship: string | null;
  inviter_first_name: string | null;
  inviter_handle: string | null;
  family_id: string | null;
  family_name: string | null;
  family_invite_code: string | null;
  voice_note_url: string | null;
  card_design: string | null;
}

/** Inviter's list of welcome invitations they've sent. */
export function useMyWelcomeInvitations() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-welcome-invitations', userId],
    queryFn: async (): Promise<WelcomeInvitation[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('welcome_invitations')
        .select('*')
        .eq('inviter_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WelcomeInvitation[];
    },
    enabled: !!userId,
  });
}

/** Public-readable bits of an invitation, fetched by the unauthenticated
 *  /welcome/{token} screen. Returns null if the token is unknown. */
export function useWelcomePublic(token: string | null | undefined) {
  return useQuery({
    queryKey: ['welcome-public', token],
    queryFn: async (): Promise<WelcomePublic | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc('welcome_invitation_public', { p_token: token });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[welcome] rpc failed', error.message);
        return null;
      }
      const row = (data ?? [])[0] as WelcomePublic | undefined;
      return row ?? null;
    },
    enabled: !!token,
    // The data is essentially static once minted.
    staleTime: 60 * 60 * 1000,
  });
}

/** Mark the invitation claimed once the recipient signs in. */
export function useClaimWelcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase.rpc('welcome_invitation_claim', { p_token: token });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-welcome-invitations'] });
      qc.invalidateQueries({ queryKey: ['welcome-public'] });
    },
  });
}

export interface CreateInvitationInput {
  recipientFirstName: string;
  recipientRelationship?: string;
  familyId?: string | null;
  cardDesign?: 'pressed-flower' | 'katagami-stencil' | 'type-only';
  voiceNoteUrl?: string;
}

export function useCreateWelcomeInvitation() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: CreateInvitationInput): Promise<WelcomeInvitation> => {
      if (!userId) throw new Error('Not signed in');
      const token = generateToken();
      const { data, error } = await supabase
        .from('welcome_invitations')
        .insert({
          token,
          inviter_id: userId,
          recipient_first_name: input.recipientFirstName.trim(),
          recipient_relationship: input.recipientRelationship?.trim() || null,
          family_id: input.familyId ?? null,
          card_design: input.cardDesign ?? 'pressed-flower',
          voice_note_url: input.voiceNoteUrl ?? null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as WelcomeInvitation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-welcome-invitations'] });
    },
  });
}

function generateToken(): string {
  // 24 random bytes → 32 url-safe chars.
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
