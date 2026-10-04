/**
 * Auth helpers for NFFGA's member flow (docs/NFFGA_CONTRACT.md, "Sign-up").
 */
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { SITE_URL } from '../../constants/site';

/** Link to the sign-in page that returns to `next` afterwards. */
export function signInHref(next?: string): string {
  return next ? `/signin?next=${encodeURIComponent(next)}` : '/signin';
}
export function joinHref(next?: string): string {
  return next ? `/join?next=${encodeURIComponent(next)}` : '/join';
}

/** Only same-site paths are honoured as a return target. */
export function safeNext(next: unknown): string {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export async function signUpMember(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    // `app: 'nffga'` is what the shared project's sign-up gate admits
    // (migration 106). display_name seeds the profile.
    options: { data: { app: 'nffga', display_name: displayName.trim() } },
  });
  if (error) return { ok: false as const, error: friendlyAuthError(error.message) };
  if (data.session) await ensureProfile(displayName);
  return { ok: true as const, needsConfirm: !data.session };
}

export async function signInMember(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { ok: false as const, error: friendlyAuthError(error.message) };
  const name = (data.user?.user_metadata?.display_name as string | undefined) ?? '';
  await ensureProfile(name);
  return { ok: true as const };
}

/** Create the caller's nffga_profiles row if it is missing. Best effort. */
export async function ensureProfile(displayName: string) {
  try {
    await supabase.rpc('nffga_ensure_profile', { p_display_name: displayName || null });
  } catch {}
}

/**
 * Ask the server to email a link that signs the person in and lets them
 * set a password. Sent through Resend in NFFGA's branded frame by
 * netlify/functions/request-password-reset.ts — never by Supabase. The
 * server answers the same way whether or not the account exists, so this
 * reveals nothing; it only fails on a network error.
 */
export async function requestEmailLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL;
  try {
    const res = await fetch(`${base}/api/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    return res.ok ? { ok: true } : { ok: false, error: 'Could not send the link. Try again shortly.' };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

export async function signOutMember() {
  await supabase.auth.signOut();
}

function friendlyAuthError(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password do not match.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account. Sign in instead.';
  if (m.includes('pilot_signup_blocked') || m.includes('database error saving new user')) return "Sign-up isn't open on the server yet. Try again shortly.";
  if (m.includes('password')) return msg;
  return msg || 'Something went wrong. Try again.';
}
