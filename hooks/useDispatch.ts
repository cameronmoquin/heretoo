/**
 * useTodayDispatch — read the viewer's "candles on the mantel" for
 * the current local day. Source of Truth, Milestone 4.
 *
 * Backed by the `today_dispatches_for_viewer()` RPC which reads from
 * room_dispatches and filters to the viewer's own profile_id +
 * timezone-aware today. Returns one or more single-sentence copy lines
 * the Room hearth surfaces below the masthead.
 *
 * The hearth shows the FIRST one. The digest (when wired) will list
 * all of them under "Today on this date."
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface RoomDispatch {
  id: string;
  profile_id: string;
  for_date: string; // YYYY-MM-DD
  rhythm_id: string | null;
  source_post_id: string | null;
  family_id: string | null;
  kind: string;
  copy: string;
  digest_only: boolean;
  created_at: string;
}

export function useTodayDispatch() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['today-dispatch', userId],
    queryFn: async (): Promise<RoomDispatch[]> => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc('today_dispatches_for_viewer');
      if (error) {
        // RLS or RPC failure — fail soft. The hearth just shows nothing.
        // eslint-disable-next-line no-console
        console.warn('[dispatch] rpc failed', error.message);
        return [];
      }
      return (data ?? []) as RoomDispatch[];
    },
    enabled: !!userId,
    // The candle stays the same across the day — refetch hourly is
    // plenty (catches the 6am dispatch run + any backfills).
    staleTime: 60 * 60 * 1000,
  });
}
