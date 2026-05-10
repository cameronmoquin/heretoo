/**
 * Hourly cleanup — delete expired Loft posts.
 *
 * Loft posts auto-expire 24 hours after creation. This function runs
 * every hour, calls the purge_expired_loft_posts() RPC, and reports
 * how many rows were removed. Idempotent.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing Supabase credentials', { status: 500 });
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/purge_expired_loft_posts`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    return new Response(JSON.stringify({ error: txt.slice(0, 200) }), { status: 500 });
  }
  const removed = await res.json();
  return new Response(JSON.stringify({ removed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { schedule: '17 * * * *' };
