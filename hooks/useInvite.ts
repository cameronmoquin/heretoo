import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import {
  createInviteCode,
  shareInvite,
  getInviteStats,
  acceptInvite,
} from '../lib/invites';

export function useInvite() {
  const userId = useAuthStore((s) => s.user?.id);
  const displayName = useAuthStore((s) => s.profile?.display_name ?? 'Someone');
  const queryClient = useQueryClient();
  const [isSharing, setIsSharing] = useState(false);

  const stats = useQuery({
    queryKey: ['invite-stats', userId],
    queryFn: () => getInviteStats(userId!),
    enabled: !!userId,
  });

  const sendInvite = useMutation({
    mutationFn: async () => {
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
      if (!userId) throw new Error('Not authenticated');
      return acceptInvite(inviteCode, userId);
    },
  });

  return {
    stats: stats.data ?? { totalSent: 0, totalAccepted: 0, invites: [] },
    isLoadingStats: stats.isLoading,
    sendInvite,
    claimInvite,
    isSharing,
  };
}
