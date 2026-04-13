import { supabase } from './supabase';

/**
 * Human verification system.
 *
 * Two paths to verification:
 * 1. Behavioral: complete 5 Pulse votes (proves engagement, not automation)
 * 2. Phone: verify a phone number (stronger signal)
 *
 * Unverified users can:
 * - Browse the feed
 * - Vote on Pulse statements
 * - View Bridge matches
 *
 * Verified users can additionally:
 * - Create posts
 * - Send Bridge messages
 * - Invite others
 * - Create Pulse statements
 */

export type VerificationStatus = {
  isVerified: boolean;
  phoneVerified: boolean;
  behavioralVerified: boolean;
  pulseVotesCount: number;
  votesUntilVerified: number;
};

/**
 * Get the current user's verification status.
 */
export async function getVerificationStatus(
  userId: string
): Promise<VerificationStatus> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'is_human_verified, phone_verified, behavioral_verified, pulse_votes_count'
    )
    .eq('id', userId)
    .single();

  if (error || !data) {
    return {
      isVerified: false,
      phoneVerified: false,
      behavioralVerified: false,
      pulseVotesCount: 0,
      votesUntilVerified: 5,
    };
  }

  return {
    isVerified: data.is_human_verified,
    phoneVerified: data.phone_verified,
    behavioralVerified: data.behavioral_verified,
    pulseVotesCount: data.pulse_votes_count,
    votesUntilVerified: Math.max(0, 5 - data.pulse_votes_count),
  };
}

/**
 * Record a pulse vote for behavioral verification progress.
 * Called after each Pulse vote.
 */
export async function recordPulseVoteForVerification(
  userId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('increment_pulse_votes', {
    p_user_id: userId,
  });

  if (error) return false;

  // Check if now verified
  const status = await getVerificationStatus(userId);
  return status.isVerified;
}

/**
 * Verify phone number.
 * In production, this would send an OTP via Twilio/similar.
 * For now, it marks the phone as verified after confirmation.
 */
export async function verifyPhone(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  // In production: send OTP, verify it, then update
  // For MVP: direct verification (replace with real OTP flow)
  const { error } = await supabase
    .from('profiles')
    .update({
      phone_verified: true,
      is_human_verified: true,
    })
    .eq('id', userId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Actions that require verification.
 */
export const VERIFICATION_REQUIRED_ACTIONS = [
  'create_post',
  'send_bridge_message',
  'send_invite',
  'create_statement',
] as const;

export type VerifiedAction = (typeof VERIFICATION_REQUIRED_ACTIONS)[number];

/**
 * Check if a user can perform a verified action.
 */
export function canPerformAction(
  status: VerificationStatus,
  _action: VerifiedAction
): boolean {
  return status.isVerified;
}
