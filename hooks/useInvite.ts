import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';
import {
  createInviteCode,
  shareInvite,
  getInviteStats,
  acceptInvite,
} from '../lib/invites';

const DEV_STATS = { totalSent: 5, totalAccepted: 3, invites: [] as any[] };

export function useInvite() {
  const userId = useAuthStore((s) => s.user?.id);
  const displayName = useAuthStore((s) => s.profile?.display_name ?? 'Someone');
  const queryClient = useQueryClient();
  const [isSharing, setIsSharing] = useState(false);

  const stats = useQuery({
    queryKey: ['invite-stats', userId],
    queryFn: () => {
      if (DEV_MODE) return DEV_STATS;
      return getInviteStats(userId!);
    },
    enabled: !!userId || DEV_MODE,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
      if (DEV_MODE) {
        setIsSharing(true);
        await shareInvite('HERETOO1', displayName);
        setIsSharing(false);
        return { code: 'HERETOO1', shared: true };
      }
      if (!userId) throw new Error('Not authenticated');
      setIsSharing(true);
      try {
        const code = await createInviteCode(userId);
        const shared = await shareInvite(code, displayName);
        return { code, shared };
      } finally {
        setIsSharing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invite-stats', userId] });
    },
  });

  const claimInvite = useMutation({
    mutationFn: async (inviteCode: string) => {
      if (DEV_MODE) return { inviterId: 'user-002' };
      if (!userId) throw new Error('Not authenticated');
      return acceptInvite(inviteCode, userId);
    },
  });

  return {
    stats: stats.data ?? DEV_STATS,
    isLoadingStats: stats.isLoading,
    sendInvite,
    claimInvite,
    isSharing,
  };
}
