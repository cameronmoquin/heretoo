// Service-role Supabase client for the render worker. The worker runs
// server-side only; the service role bypasses RLS so it can read any
// project it's asked to render and write to the private books bucket.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  // Fail loud at boot; a misconfigured worker is worse than a crash.
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

export const BOOKS_BUCKET = 'memoir-books';
