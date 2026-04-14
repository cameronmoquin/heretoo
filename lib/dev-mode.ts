/**
 * Dev mode flag.
 * FALSE = real Supabase. Everything is live.
 */

export const DEV_MODE = false;

export function isDevMode(): boolean {
  return DEV_MODE;
}
