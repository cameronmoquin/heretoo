/**
 * Hourly: end any video call still ongoing past 4 hours.
 * Bumps ended_at on the row; the realtime channel gets garbage-
 * collected separately as peers disconnect.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing creds', { status: 500 });
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/cleanup_stale_video_calls`,
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
  const ended = await res.json();
  return new Response(JSON.stringify({ ended }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = { schedule: '23 * * * *' };
