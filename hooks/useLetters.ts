/**
 * Letters — long-form, scheduled, addressed-to-one-person writing.
 * Source of Truth, Milestone 5. Schema in 030_letters.sql.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface Letter {
  id: string;
  author_id: string | null;
  family_id: string | null;
  body_md: string;
  body_plain: string | null;
  audio_url: string | null;
  deliver_at: string;
  delivered_at: string | null;
  proceeds_after_death: boolean;
  created_at: string;
  updated_at: string;
}

export interface LetterRecipient {
  id: string;
  letter_id: string;
  user_id: string | null;
  future_recipient_label: string | null;
  future_recipient_token: string | null;
  read_at: string | null;
}

export interface LetterWithMeta extends Letter {
  recipients: LetterRecipient[];
  author?: { id: string; handle: string | null; display_name: string | null; avatar_path: string | null } | null;
}

/** Letters authored by the viewer (drafts + queued + delivered). */
export function useMyLetters() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['my-letters', userId],
    queryFn: async (): Promise<LetterWithMeta[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('letters')
        .select(`*, recipients:letter_recipients(*)`)
        .eq('author_id', userId)
        .order('deliver_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LetterWithMeta[];
    },
    enabled: !!userId,
  });
}

/** Letters delivered TO the viewer (their inbox). */
export function useReceivedLetters() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['received-letters', userId],
    queryFn: async (): Promise<LetterWithMeta[]> => {
      if (!userId) return [];
      // Two-step: find letter_recipients rows where user_id = me, then
      // pull the parent letters that are delivered.
      const { data: rrows, error: rErr } = await supabase
        .from('letter_recipients')
        .select('letter_id, read_at')
        .eq('user_id', userId);
      if (rErr) throw rErr;
      const letterIds = (rrows ?? []).map((r) => r.letter_id);
      if (letterIds.length === 0) return [];

      const { data: letters, error: lErr } = await supabase
        .from('letters')
        .select(`
          *,
          author:profiles!author_id(id, handle, display_name, avatar_path),
          recipients:letter_recipients(*)
        `)
        .in('id', letterIds)
        .not('delivered_at', 'is', null)
        .order('delivered_at', { ascending: false });
      if (lErr) throw lErr;
      return (letters ?? []) as LetterWithMeta[];
    },
    enabled: !!userId,
  });
}

export function useLetter(id: string | null | undefined) {
  return useQuery({
    queryKey: ['letter', id],
    queryFn: async (): Promise<LetterWithMeta | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('letters')
        .select(`
          *,
          author:profiles!author_id(id, handle, display_name, avatar_path),
          recipients:letter_recipients(*)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
    enabled: !!id,
  });
}

export interface CreateLetterInput {
  body_md: string;
  body_plain: string;
  deliver_at: string;        // ISO
  family_id?: string | null;
  recipients: Array<
    | { kind: 'user'; user_id: string }
    | { kind: 'future'; label: string; careOfEmail?: string }
  >;
}

export function useCreateLetter() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: CreateLetterInput): Promise<Letter> => {
      if (!userId) throw new Error('Not signed in');
      const { data: letter, error } = await supabase
        .from('letters')
        .insert({
          author_id: userId,
          family_id: input.family_id ?? null,
          body_md: input.body_md,
          body_plain: input.body_plain,
          deliver_at: input.deliver_at,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Insert recipients. Future recipients get a generated token.
      if (input.recipients.length > 0) {
        const rows = input.recipients.map((r) => {
          if (r.kind === 'user') {
            return { letter_id: letter.id, user_id: r.user_id };
          }
          return {
            letter_id: letter.id,
            future_recipient_label: r.label,
            future_recipient_token: cryptoToken(),
            care_of_email: r.careOfEmail || null,
          };
        });
        const { error: rErr } = await supabase.from('letter_recipients').insert(rows as any);
        if (rErr) throw rErr;
      }

      return letter as Letter;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-letters'] });
    },
  });
}

export function useUpdateLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body_md?: string;
      body_plain?: string;
      deliver_at?: string;
    }) => {
      const updates: Record<string, any> = {};
      if (input.body_md !== undefined) updates.body_md = input.body_md;
      if (input.body_plain !== undefined) updates.body_plain = input.body_plain;
      if (input.deliver_at !== undefined) updates.deliver_at = input.deliver_at;
      const { error } = await supabase
        .from('letters')
        .update(updates)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['my-letters'] });
      qc.invalidateQueries({ queryKey: ['letter', vars.id] });
    },
  });
}

export function useDeleteLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('letters').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-letters'] });
    },
  });
}

export function useMarkLetterRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (letterId: string) => {
      if (!userId) return;
      await supabase
        .from('letter_recipients')
        .update({ read_at: new Date().toISOString() } as any)
        .eq('letter_id', letterId)
        .eq('user_id', userId)
        .is('read_at', null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['received-letters'] });
    },
  });
}

export function useClaimLetterToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await supabase.rpc('claim_letter_token', { p_token: token });
      if (error) throw error;
      const row = (data ?? [])[0] as { letter_id: string } | undefined;
      if (!row) throw new Error('Token not found');
      return row.letter_id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['received-letters'] });
    },
  });
}

// ── helpers ─────────────────────────────────────────────────────────

function cryptoToken(): string {
  // 24 random bytes → 32 url-safe chars. Crypto-grade in browsers.
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
