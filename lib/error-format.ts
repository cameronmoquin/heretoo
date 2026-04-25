/**
 * Translate raw Supabase / PostgREST errors into human-readable strings.
 * Keeps technical detail in the dev console but never surfaces it directly
 * to the user.
 */

import { authRecoveryHint, isAuthSuspectError, type SupabaseLikeError } from './auth-recovery';

export interface FormattedError {
  /** What we show the user. */
  message: string;
  /** True if this looks like a stale-JWT / bad-auth issue. */
  authSuspect: boolean;
  /** Original error message, kept for the developer console. */
  raw: string;
  /** Postgres / PostgREST code if any. */
  code: string | null;
}

const RLS_INSERT = /violates row-level security policy/i;
const RLS_UPDATE = /permission denied for table/i;
const FK_VIOLATION = /violates foreign key constraint/i;
const UNIQUE_VIOLATION = /duplicate key value violates unique constraint/i;
const NOT_NULL = /null value in column "([^"]+)"/i;
const CHECK_VIOLATION = /violates check constraint "([^"]+)"/i;
const NETWORK = /failed to fetch|network request failed/i;

export function formatPgError(err: unknown, fallback = 'Something went wrong.'): FormattedError {
  if (!err) {
    return { message: fallback, authSuspect: false, raw: '', code: null };
  }
  const e = err as SupabaseLikeError & { name?: string };
  const raw = `${e.message ?? ''} ${e.details ?? ''}`.trim();
  const code = e.code ?? null;
  const authSuspect = isAuthSuspectError(err);

  // Auth / RLS family
  if (authSuspect) {
    return {
      message:
        authRecoveryHint(err)
        ?? 'Your session needs to be refreshed. Sign out and back in.',
      authSuspect: true,
      raw,
      code,
    };
  }

  if (RLS_INSERT.test(raw)) {
    return {
      message:
        'You don\'t have permission to do this here. '
        + 'Check that you\'re a member of the right group.',
      authSuspect: false,
      raw,
      code,
    };
  }

  if (RLS_UPDATE.test(raw)) {
    return {
      message: 'You don\'t have permission to change this.',
      authSuspect: false,
      raw,
      code,
    };
  }

  const notNull = raw.match(NOT_NULL);
  if (notNull) {
    return {
      message: `Missing required field: ${humanizeColumn(notNull[1])}.`,
      authSuspect: false,
      raw,
      code,
    };
  }

  const checkV = raw.match(CHECK_VIOLATION);
  if (checkV) {
    return {
      message: `That value isn\'t allowed (${humanizeColumn(checkV[1])}).`,
      authSuspect: false,
      raw,
      code,
    };
  }

  if (FK_VIOLATION.test(raw)) {
    return {
      message: 'That referenced item no longer exists. Refresh and try again.',
      authSuspect: false,
      raw,
      code,
    };
  }

  if (UNIQUE_VIOLATION.test(raw)) {
    return {
      message: 'That already exists.',
      authSuspect: false,
      raw,
      code,
    };
  }

  if (NETWORK.test(raw)) {
    return {
      message: 'Network problem. Check your connection and try again.',
      authSuspect: false,
      raw,
      code,
    };
  }

  return { message: e.message ?? fallback, authSuspect: false, raw, code };
}

function humanizeColumn(c: string): string {
  return c
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/Id$/, 'ID');
}
