import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import {
  getVerificationStatus,
  recordPulseVoteForVerification,
  canPerformAction,
  type VerifiedAction,
  type VerificationStatus,
} from '../lib/verification';

export function useVerification() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['verification-status', userId],
    queryFn: () => getVerificationStatus(userId!),
    enabled: !!userId,
  });

  const status: VerificationStatus = query.data ?? {
    isVerified: false,
    phoneVerified: false,
    behavioralVerified: false,
    pulseVotesCount: 0,
    votesUntilVerified: 5,
  };

  async function recordVote(): Promise<boolean> {
    if (!userId) return false;
    const verified = await recordPulseVoteForVerification(userId);
    queryClient.invalidateQueries({ queryKey: ['verification-status', userId] });
    return verified;
  }

  function canDo(action: VerifiedAction): boolean {
    return canPerformAction(status, action);
  }

  return {
    ...status,
    isLoading: query.isLoading,
    recordVote,
    canDo,
    refetch: query.refetch,
  };
}
