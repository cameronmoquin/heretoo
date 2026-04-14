import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { useAuthStore } from '../stores/authStore';
import { WAMP } from '../constants/wamp';

export interface Wallet {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  lifetime_transferred: number;
}

export interface WampTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

const MOCK_WALLET: Wallet = {
  balance: 2.35,
  lifetime_earned: 4.85,
  lifetime_spent: 2.00,
  lifetime_transferred: 0.50,
};

const MOCK_TRANSACTIONS: WampTransaction[] = [
  { id: '1', type: 'genesis', amount: 0.50, balance_after: 0.50, note: 'Welcome to HereToo', created_at: '2026-04-01T00:00:00Z' },
  { id: '2', type: 'earn_vote', amount: 0.02, balance_after: 0.52, note: null, created_at: '2026-04-02T10:00:00Z' },
  { id: '3', type: 'earn_vote', amount: 0.02, balance_after: 0.54, note: null, created_at: '2026-04-02T10:05:00Z' },
  { id: '4', type: 'earn_bridge', amount: 0.25, balance_after: 0.79, note: 'Bridge with Allen Hazard', created_at: '2026-04-03T14:00:00Z' },
  { id: '5', type: 'earn_daily_login', amount: 0.05, balance_after: 0.84, note: null, created_at: '2026-04-04T08:00:00Z' },
  { id: '6', type: 'earn_post_bridging', amount: 0.10, balance_after: 0.94, note: 'Post reached 4 communities', created_at: '2026-04-05T12:00:00Z' },
  { id: '7', type: 'spend_invite', amount: -1.00, balance_after: 1.35, note: 'Invited a friend', created_at: '2026-04-08T09:00:00Z' },
  { id: '8', type: 'earn_invite_accepted', amount: 0.20, balance_after: 1.55, note: 'Your invite was accepted', created_at: '2026-04-08T15:00:00Z' },
  { id: '9', type: 'earn_bridge', amount: 0.25, balance_after: 1.80, note: 'Bridge with Vega', created_at: '2026-04-10T11:00:00Z' },
  { id: '10', type: 'transfer_out', amount: -0.50, balance_after: 1.30, note: 'Sent to Sandy Corvo', created_at: '2026-04-11T16:00:00Z' },
  { id: '11', type: 'earn_daily_login', amount: 0.05, balance_after: 1.35, note: null, created_at: '2026-04-12T08:00:00Z' },
  { id: '12', type: 'earn_post_bridging', amount: 0.10, balance_after: 2.35, note: null, created_at: '2026-04-13T10:00:00Z' },
];

export function useWallet() {
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  const wallet = useQuery({
    queryKey: ['wallet', userId],
    queryFn: async () => {
      if (DEV_MODE) return MOCK_WALLET;
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, lifetime_earned, lifetime_spent, lifetime_transferred')
        .eq('user_id', userId)
        .single();
      if (error || !data) return MOCK_WALLET;
      return data as Wallet;
    },
  });

  const transactions = useQuery({
    queryKey: ['wallet-transactions', userId],
    queryFn: async () => {
      if (DEV_MODE) return MOCK_TRANSACTIONS;
      const { data, error } = await supabase
        .from('wamp_transactions')
        .select('id, type, amount, balance_after, note, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return MOCK_TRANSACTIONS;
      return data as WampTransaction[];
    },
  });

  return {
    wallet: wallet.data ?? MOCK_WALLET,
    transactions: transactions.data ?? MOCK_TRANSACTIONS,
    isLoading: wallet.isLoading,
  };
}

export function useSpendInvite() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  return useMutation({
    mutationFn: async () => {
      if (DEV_MODE) return { code: 'WAMP' + Math.random().toString(36).slice(2, 6).toUpperCase() };

      const { data, error } = await supabase.rpc('spend_wamp', {
        p_user_id: userId,
        p_amount: WAMP.INVITE_COST,
        p_type: 'spend_invite',
      });
      if (error) throw new Error(error.message);

      // Generate invite code
      const code = 'W' + Math.random().toString(36).slice(2, 8).toUpperCase();
      await supabase.from('invites').insert({
        inviter_id: userId,
        invite_code: code,
        wamp_cost: WAMP.INVITE_COST,
      });

      return { code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
  });
}

export function useTransferWamp() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id) ?? 'user-001';

  return useMutation({
    mutationFn: async ({ toUsername, amount }: { toUsername: string; amount: number }) => {
      if (DEV_MODE) return { success: true };

      // Find recipient
      const { data: recipient } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', toUsername)
        .single();

      if (!recipient) throw new Error('User not found');

      const { error } = await supabase.rpc('transfer_wamp', {
        p_from_user: userId,
        p_to_user: recipient.id,
        p_amount: amount,
      });
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    },
  });
}
