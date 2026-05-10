/**
 * Donation transparency — public reporting + admin disbursement entry.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface TransparencyReport {
  total_received_cents: number;
  total_disbursed_cents: number;
  pending_cents: number;
  donor_count: number;
  disbursement_count: number;
  last_disbursed_at: string | null;
  current_beneficiary: string | null;
}

export interface Disbursement {
  id: string;
  beneficiary: string;
  amount_cents: number;
  disbursed_at: string;
  reference: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
}

export function useTransparencyReport() {
  return useQuery({
    queryKey: ['transparency-report'],
    queryFn: async (): Promise<TransparencyReport> => {
      const { data, error } = await supabase.rpc('donation_transparency_report');
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[transparency] rpc failed', error.message);
        return zero();
      }
      const row = ((data ?? []) as any[])[0];
      if (!row) return zero();
      return {
        total_received_cents: Number(row.total_received_cents ?? 0),
        total_disbursed_cents: Number(row.total_disbursed_cents ?? 0),
        pending_cents: Number(row.pending_cents ?? 0),
        donor_count: row.donor_count ?? 0,
        disbursement_count: row.disbursement_count ?? 0,
        last_disbursed_at: row.last_disbursed_at ?? null,
        current_beneficiary: row.current_beneficiary ?? null,
      };
    },
    staleTime: 60_000,
  });
}

function zero(): TransparencyReport {
  return {
    total_received_cents: 0,
    total_disbursed_cents: 0,
    pending_cents: 0,
    donor_count: 0,
    disbursement_count: 0,
    last_disbursed_at: null,
    current_beneficiary: null,
  };
}

export function useDisbursements() {
  return useQuery({
    queryKey: ['disbursements'],
    queryFn: async (): Promise<Disbursement[]> => {
      const { data, error } = await supabase
        .from('donation_disbursements')
        .select('*')
        .order('disbursed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Disbursement[];
    },
    staleTime: 60_000,
  });
}

export function useIsDonationAdmin() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['is-donation-admin', userId],
    queryFn: async (): Promise<boolean> => {
      if (!userId) return false;
      const { data, error } = await supabase.rpc('viewer_is_donation_admin');
      if (error) return false;
      return !!data;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useRecordDisbursement() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (input: {
      beneficiary: string;
      amount_cents: number;
      disbursed_at: string;       // YYYY-MM-DD
      reference?: string;
      note?: string;
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('donation_disbursements')
        .insert({
          beneficiary: input.beneficiary.trim(),
          amount_cents: input.amount_cents,
          disbursed_at: input.disbursed_at,
          reference: input.reference?.trim() || null,
          note: input.note?.trim() || null,
          recorded_by: userId,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transparency-report'] });
      qc.invalidateQueries({ queryKey: ['disbursements'] });
    },
  });
}

export function useDeleteDisbursement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('donation_disbursements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transparency-report'] });
      qc.invalidateQueries({ queryKey: ['disbursements'] });
    },
  });
}
