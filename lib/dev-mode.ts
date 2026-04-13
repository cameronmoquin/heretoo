/**
 * Dev mode flag.
 * When true, the app uses mock data and skips Supabase entirely.
 * Flip to false once your Supabase project has migrations run + auth configured.
 */

export const DEV_MODE = true;

export function isDevMode(): boolean {
  return DEV_MODE;
}
