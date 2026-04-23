import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export type OutreachMode = 'personal' | 'family' | 'work' | 'campaign';

export interface Contact {
  id: string;
  user_id: string;
  display_name: string;
  phone_e164: string | null;
  email: string | null;
  relationship_type: string;
  outreach_mode: OutreachMode;
  organization: string | null;
  role_title: string | null;
  closeness_score: number;
  preferred_frequency_days: number;
  birthday: string | null;
  tone_preference: string | null;
  manual_only: boolean;
  notes: string | null;
  last_contact_at: string | null;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useContacts(mode?: OutreachMode) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['candon-contacts', userId, mode ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('candon_contacts')
        .select('*')
        .order('display_name', { ascending: true });
      if (mode) q = q.eq('outreach_mode', mode);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    enabled: !!userId,
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: ['candon-contact', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('candon_contacts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (input: Partial<Contact> & { display_name: string }) => {
      if (!userId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('candon_contacts')
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-contacts'] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from('candon_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['candon-contacts'] });
      qc.invalidateQueries({ queryKey: ['candon-contact', vars.id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('candon_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candon-contacts'] });
    },
  });
}
