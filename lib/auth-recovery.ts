/**
 * Auth recovery helpers.
 *
 * The single class of bug we are trying to prevent: a stale or invalid JWT
 * in browser storage that PostgREST silently rejects, surfacing as
 * "new row violates row-level security policy" rather than an auth error.
 *
 * Strategy:
 *   1. On any operation that fails with an auth-shaped error, try
 *      `supabase.auth.refreshSession()` once. If that succeeds, retry.
 *   2. If refresh fails, hard sign-out and bounce the user to /candon/reset
 *      (web) or the welcome screen (native).
 */

import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

// Postgres / PostgREST error codes / messages we treat as "the JWT is bad."
// Note: 42501 (insufficient_privilege) is intentionally NOT here — it usually
// means the user genuinely lacks permission, not that their session is stale.
const AUTH_SUSPECT_CODES = new Set([
  'PGRST301', // JWT expired
  'PGRST302', // JWT invalid
]);

const AUTH_SUSPECT_FRAGMENTS = [
  'jwt expired',
  'jwt is invalid',
  'invalid jwt',
  'no api key found',
  'invalid api key',
];

export interface SupabaseLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

export function isAuthSuspectError(err: unknown): boolean {
  if (!err) return false;
  const e = err as SupabaseLikeError;
  if (e.code && AUTH_SUSPECT_CODES.has(e.code)) return true;
  const msg = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
  return AUTH_SUSPECT_FRAGMENTS.some((f) => msg.includes(f));
}

/**
 * Translate a raw Supabase/Postgres error into a human sentence.
 * Used by `formatPgError` in lib/error-format.ts. Kept narrow on purpose —
 * we only translate the cases we know.
 */
export function authRecoveryHint(err: unknown): string | null {
  if (!isAuthSuspectError(err)) return null;
  return (
    'Your sign-in session looks stale. Try signing out and back in. '
    + 'If this keeps happening, visit /candon/reset to fully clear your device.'
  );
}

let recoveryInFlight: Promise<boolean> | null = null;

/**
 * Attempt a single refresh-and-retry. Returns true if recovery probably
 * succeeded (caller should retry the original op). Returns false if recovery
 * failed (caller should show the user an error and the recovery flow has
 * already redirected them to the reset page).
 */
export async function tryRefreshSession(): Promise<boolean> {
  if (recoveryInFlight) return recoveryInFlight;
  recoveryInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data?.session) {
        await hardSignOutAndRedirect();
        return false;
      }
      return true;
    } catch {
      await hardSignOutAndRedirect();
      return false;
    } finally {
      // Reset the latch on the next tick so subsequent independent failures
      // can each get their own recovery attempt.
      setTimeout(() => { recoveryInFlight = null; }, 250);
    }
  })();
  return recoveryInFlight;
}

export async function hardSignOutAndRedirect(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'global' });
  } catch {}
  try { useAuthStore.getState().reset(); } catch {}

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // /candon/reset will purge any remaining storage and redirect to sign-in.
    window.location.href = '/candon/reset';
  } else {
    try { router.replace('/(auth)/welcome'); } catch {}
  }
}

/**
 * Wrap a Supabase call with auto-recovery.
 *
 * Two cases trigger a refresh-and-retry:
 *   1. The error is overtly auth-shaped (PGRST301 / 302 / "jwt expired" etc.)
 *   2. The error looks like permission-denied (42501 / RLS) AND there is no
 *      currently-valid session, OR the session's expires_at is in the past.
 *      That distinguishes a stale JWT (recover) from a real permission
 *      violation (let the error through).
 */
export async function withAuthRecovery<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    let shouldRecover = isAuthSuspectError(err);

    // Permission-denied + no live session → almost always a stale JWT
    // (PostgREST sees auth.uid() as null and the RLS check fails).
    if (!shouldRecover && looksLikePermissionDenied(err)) {
      try {
        const { data } = await supabase.auth.getSession();
        const expAt = data.session?.expires_at ?? 0; // unix seconds
        const nowSec = Math.floor(Date.now() / 1000);
        const expired = !data.session || expAt <= nowSec;
        if (expired) shouldRecover = true;
      } catch {
        shouldRecover = true; // can't even read the session — definitely auth
      }
    }

    if (!shouldRecover) throw err;
    const recovered = await tryRefreshSession();
    if (!recovered) throw err;
    return op();
  }
}

function looksLikePermissionDenied(err: unknown): boolean {
  if (!err) return false;
  const e = err as SupabaseLikeError;
  if (e.code === '42501') return true;
  const msg = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
  return msg.includes('row-level security')
    || msg.includes('permission denied')
    || msg.includes('insufficient privilege');
}
