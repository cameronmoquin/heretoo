import { supabase } from './supabase';
import { DEV_MODE } from './dev-mode';

export type FlagReason =
  | 'spam'
  | 'bot'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'violence'
  | 'sexual'
  | 'impersonation'
  | 'other';

export type ContentType = 'post' | 'message' | 'statement' | 'profile';

/**
 * Flag content for moderation.
 * Goes through the flag-content Edge Function which handles
 * rate limiting, duplicate checking, and cross-cluster escalation.
 */
export async function flagContent(params: {
  contentType: ContentType;
  contentId: string;
  reason: FlagReason;
  description?: string;
}): Promise<void> {
  if (DEV_MODE) return; // No-op in dev

  const { data, error } = await supabase.functions.invoke('flag-content', {
    body: {
      action: 'create',
      ...params,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

/**
 * Appeal a moderation decision.
 */
export async function appealFlag(params: {
  flagId: string;
  appealText: string;
}): Promise<void> {
  if (DEV_MODE) return;
  const { data, error } = await supabase.functions.invoke('flag-content', {
    body: {
      action: 'appeal',
      ...params,
    },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

/**
 * Check rate limit before performing an action.
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(
  action: 'post' | 'engage' | 'vote' | 'message' | 'invite' | 'flag'
): Promise<{ allowed: boolean; reason?: string }> {
  if (DEV_MODE) return { allowed: true };
  const { data, error } = await supabase.functions.invoke('rate-limit', {
    body: { action },
  });

  if (error) {
    // If rate limit service is down, allow the action (fail open for UX)
    return { allowed: true };
  }

  return data;
}

export const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'bot', label: 'Suspected Bot' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'violence', label: 'Violence' },
  { value: 'sexual', label: 'Sexual Content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];
