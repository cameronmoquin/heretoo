import * as Linking from 'expo-linking';
import { Share, Platform } from 'react-native';
import { supabase } from './supabase';

const APP_SCHEME = 'heretoo';
const WEB_URL = 'https://heretoo.social';

/**
 * Generate a unique invite code for the current user.
 */
export async function createInviteCode(userId: string): Promise<string> {
  // Generate a short, readable code
  const code = generateCode();

  const { error } = await supabase.from('invites').insert({
    inviter_id: userId,
    invite_code: code,
  });

  if (error) {
    // If code collision, retry once
    if (error.code === '23505') {
      const retryCode = generateCode();
      const { error: retryError } = await supabase.from('invites').insert({
        inviter_id: userId,
        invite_code: retryCode,
      });
      if (retryError) throw retryError;
      return retryCode;
    }
    throw error;
  }

  return code;
}

/**
 * Build the invite deep link.
 */
export function getInviteLink(code: string): string {
  return `${WEB_URL}/invite/${code}`;
}

/**
 * Build the in-app deep link for the invite.
 */
export function getInviteDeepLink(code: string): string {
  return Linking.createURL(`/invite/${code}`);
}

/**
 * Open the native share sheet with the invite link.
 */
export async function shareInvite(code: string, inviterName: string): Promise<boolean> {
  const link = getInviteLink(code);
  const message = `Join my family on HereToo.social — ${link}`;

  try {
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message, url: link }
        : { message }
    );

    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}

/**
 * Accept an invite code during signup.
 * Called after the new user's profile is created.
 */
export async function acceptInvite(
  inviteCode: string,
  newUserId: string
): Promise<{ inviterId: string } | null> {
  // Find the invite
  const { data: invite, error: findError } = await supabase
    .from('invites')
    .select('id, inviter_id, accepted_by')
    .eq('invite_code', inviteCode)
    .single();

  if (findError || !invite) return null;
  if (invite.accepted_by) return null; // Already claimed

  // Mark as accepted
  const { error: updateError } = await supabase
    .from('invites')
    .update({
      accepted_by: newUserId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) return null;

  // Update the new user's profile with invited_by
  await supabase
    .from('profiles')
    .update({ invited_by: invite.inviter_id })
    .eq('id', newUserId);

  // Increment inviter's invite count
  await supabase.rpc('increment_invite_count', {
    user_id: invite.inviter_id,
  });

  return { inviterId: invite.inviter_id };
}

/**
 * Get invite stats for a user.
 */
export async function getInviteStats(userId: string): Promise<{
  totalSent: number;
  totalAccepted: number;
  invites: Array<{
    code: string;
    acceptedBy: string | null;
    createdAt: string;
  }>;
}> {
  const { data, error } = await supabase
    .from('invites')
    .select('invite_code, accepted_by, created_at')
    .eq('inviter_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { totalSent: 0, totalAccepted: 0, invites: [] };
  }

  return {
    totalSent: data.length,
    totalAccepted: data.filter((i) => i.accepted_by).length,
    invites: data.map((i) => ({
      code: i.invite_code,
      acceptedBy: i.accepted_by,
      createdAt: i.created_at,
    })),
  };
}

/**
 * Generate a short readable invite code.
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
