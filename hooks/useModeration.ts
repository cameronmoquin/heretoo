import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  flagContent,
  appealFlag,
  checkRateLimit,
  type FlagReason,
  type ContentType,
} from '../lib/moderation';

export function useFlagContent() {
  return useMutation({
    mutationFn: async (params: {
      contentType: ContentType;
      contentId: string;
      reason: FlagReason;
      description?: string;
    }) => {
      return flagContent(params);
    },
  });
}

export function useAppealFlag() {
  return useMutation({
    mutationFn: async (params: { flagId: string; appealText: string }) => {
      return appealFlag(params);
    },
  });
}

export function useRateLimit() {
  return useMutation({
    mutationFn: async (
      action: 'post' | 'engage' | 'vote' | 'message' | 'invite' | 'flag'
    ) => {
      return checkRateLimit(action);
    },
  });
}
