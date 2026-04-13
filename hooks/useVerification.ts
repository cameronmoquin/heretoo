import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { DEV_MODE } from '../lib/dev-mode';
import {
  getVerificationStatus,
  recordPulseVoteForVerification,
  canPerformAction,
  type VerifiedAction,
  type VerificationStatus,
} from '../lib/verification';

const DEV_STATUS: VerificationStatus = {
  isVerified: true,
  phoneVerified: false,
  behavioralVerified: true,
  pulseVotesCount: 12,
  votesUntilVerified: 0,
};

export function useVerification() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['verification-status', userId],
    queryFn: () => {
      if (DEV_MODE) return DEV_STATUS;
      return getVerificationStatus(userId!);
    },
    enabled: !!userId || DEV_MODE,
  });

  const status: VerificationStatus = query.data ?? (DEV_MODE ? DEV_STATUS : {
    isVerified: false,
    phoneVerified: false,
    behavioralVerified: false,
    pulseVotesCount: 0,
    votesUntilVerified: 5,
  });

  async function recordVote(): Promise<boolean> {
    if (DEV_MODE) return true;
    if (!userId) return false;
    const verified = await recordPulseVoteForVerification(userId);
    queryClient.invalidateQueries({ queryKey: ['verification-status', userId] });
    return verified;
  }

  function canDo(action: VerifiedAction): boolean {
    if (DEV_MODE) return true;
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
