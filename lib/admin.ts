/**
 * admin — the client side of migration 102 (nffga_admins).
 *
 * Seats are claimed only from a session created by an emailed link
 * (the database checks the JWT's `amr`), because the EMSPCR auth project
 * auto-confirms new emails and a password session proves nothing about
 * who owns the inbox. See the migration header for the full reasoning.
 *
 * So there are two ways through the admin door:
 *   FIRST TIME  email → sendAdminLink() → click the link → /admin adopts
 *               the session from the URL → claimAdminSeat() → set a
 *               password on the admin screen.
 *   AFTER THAT  email + password → claimAdminSeat() returns the seat
 *               already held → /admin.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { SITE_URL } from '../constants/site';
import { requestEmailLink } from './nffga/auth';

export type AdminRole =
  | 'super_admin' | 'managing_admin' | 'admin' | 'president' | 'director'
  | 'tournament_chair' | 'treasurer' | 'secretary';

/** Roles a super or managing admin can hand out from the admin screen. */
export const GRANTABLE_ROLES: AdminRole[] = [
  'managing_admin', 'admin', 'president', 'director', 'tournament_chair', 'treasurer', 'secretary',
];

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  managing_admin: 'Managing admin',
  admin: 'Admin',
  president: 'President',
  director: 'Director',
  tournament_chair: 'Tournament chair',
  treasurer: 'Treasurer',
  secretary: 'Secretary',
};

const RANK: Record<AdminRole, number> = {
  super_admin: 3, managing_admin: 2, admin: 1, president: 1, director: 1,
  tournament_chair: 1, treasurer: 1, secretary: 1,
};
export function canGrant(me: AdminRole | null, role: AdminRole): boolean {
  return !!me && RANK[me] >= 2 && RANK[role] < RANK[me];
}

export type ClaimError =
  | 'not_signed_in' | 'not_designated' | 'already_claimed' | 'email_link_required' | 'unavailable';

export interface ClaimResult {
  ok: boolean;
  role?: AdminRole;
  claimed?: boolean;
  error?: ClaimError;
}

/** Where the emailed link lands. Must be in the Supabase project's
 *  allowed redirect URLs, or Supabase falls back to its Site URL. */
export function adminRedirectUrl(): string {
  const base = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : SITE_URL;
  return `${base}/admin`;
}

/** Email the branded sign-in link (a Resend-delivered recovery link; see
 *  lib/nffga/auth.ts requestEmailLink). The account must already exist —
 *  first-time admins create one at /join, then use this to prove the
 *  inbox and claim the seat (migration 109 accepts reset-link sessions). */
export async function sendAdminLink(email: string): Promise<{ ok: boolean; error?: string }> {
  return requestEmailLink(email);
}

export async function claimAdminSeat(): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_admin_seat');
  if (error) return { ok: false, error: 'unavailable' };
  return data as ClaimResult;
}

export interface AdminRow {
  email: string;
  role: AdminRole;
  claimed: boolean;
  designated_at: string;
  claimed_at: string | null;
}

export async function listAdmins(): Promise<AdminRow[]> {
  const { data, error } = await supabase.rpc('list_nffga_admins');
  if (error) throw error;
  return (data ?? []) as AdminRow[];
}

export async function designateAdmin(email: string, role: AdminRole): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('designate_admin', { p_email: email, p_role: role });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

export async function revokeAdmin(email: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('revoke_admin', { p_email: email });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

/**
 * Turn the emailed link's URL into a session. The client is built with
 * detectSessionInUrl off (lib/supabase.ts), so nothing does this for us.
 * Handles all three shapes Supabase links arrive in: implicit-flow hash
 * tokens, a PKCE ?code=, and a ?token_hash=&type=. Clears the URL after,
 * so a refresh or a shared screenshot does not carry the token.
 * Returns true if a session was adopted.
 */
export async function adoptSessionFromUrl(): Promise<{ adopted: boolean; error?: string }> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { adopted: false };
  const { location, history } = window;
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  // Strip the link's parameters from the address bar so a refresh, a
  // bookmark or a screenshot never carries a token. Repeated after the
  // router settles: on a cold load expo-router writes its starting URL
  // AFTER this screen mounts, which would put the fragment straight back.
  // Each pass touches the URL only while it still carries link params
  // and the person is still on this page.
  const path = location.pathname;
  const LINK_PARAM = /(^|[#?&])(access_token|refresh_token|code|token_hash|error_description)=/;
  const scrub = () => {
    try {
      if (location.pathname === path && (LINK_PARAM.test(location.hash) || LINK_PARAM.test(location.search))) {
        history.replaceState(history.state, '', path);
      }
    } catch {}
  };
  const clean = () => { scrub(); setTimeout(scrub, 300); setTimeout(scrub, 1200); setTimeout(scrub, 3000); };

  const linkError = hash.get('error_description') || query.get('error_description');
  if (linkError) {
    clean();
    return { adopted: false, error: linkError.replace(/\+/g, ' ') };
  }

  try {
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      clean();
      return error ? { adopted: false, error: error.message } : { adopted: true };
    }
    const code = query.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      clean();
      return error ? { adopted: false, error: error.message } : { adopted: true };
    }
    const token_hash = query.get('token_hash');
    const type = query.get('type');
    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
      clean();
      return error ? { adopted: false, error: error.message } : { adopted: true };
    }
  } catch (e: any) {
    clean();
    return { adopted: false, error: e?.message ?? 'That link could not be used.' };
  }
  return { adopted: false };
}

/** Plain-language text for a claim refusal. */
export function claimErrorText(err?: ClaimError): string {
  switch (err) {
    case 'not_designated':
      return "This email doesn't have admin access.";
    case 'email_link_required':
      return 'First sign-in has to use the emailed link. Use "Email me a sign-in link" below.';
    case 'already_claimed':
      return 'This admin seat is already held by another account. Contact the super admin.';
    case 'not_signed_in':
      return 'Your session ended. Sign in again.';
    default:
      return "Admin access isn't set up on the server yet.";
  }
}
