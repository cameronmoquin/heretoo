/**
 * Dev mode flag.
 * When true, the app uses mock data and skips Supabase entirely.
 * When false, the app uses the real Supabase backend.
 */

export const DEV_MODE = false;

export function isDevMode(): boolean {
  return DEV_MODE;
}
