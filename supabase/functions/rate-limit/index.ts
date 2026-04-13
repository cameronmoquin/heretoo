import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Rate limit configuration per action type.
 * { max actions, per window in minutes }
 */
const RATE_LIMITS: Record<string, { max: number; windowMinutes: number }> = {
  post:    { max: 10, windowMinutes: 60 },     // 10 posts per hour
  engage:  { max: 100, windowMinutes: 60 },    // 100 engagements per hour
  vote:    { max: 200, windowMinutes: 60 },    // 200 pulse votes per hour
  message: { max: 50, windowMinutes: 60 },     // 50 bridge messages per hour
  invite:  { max: 20, windowMinutes: 1440 },   // 20 invites per day
  flag:    { max: 10, windowMinutes: 60 },     // 10 flags per hour
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { action } = await req.json();

  if (!action || !RATE_LIMITS[action]) {
    return new Response(
      JSON.stringify({ error: 'Invalid action type' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is suspended
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_suspended')
    .eq('id', user.id)
    .single();

  if (profile?.is_suspended) {
    return new Response(
      JSON.stringify({ allowed: false, reason: 'Account suspended' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const limit = RATE_LIMITS[action];

  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_user_id: user.id,
    p_action: action,
    p_max_count: limit.max,
    p_window_minutes: limit.windowMinutes,
  });

  if (!allowed) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: `Rate limited: max ${limit.max} ${action} actions per ${limit.windowMinutes} minutes`,
        retryAfterMinutes: limit.windowMinutes,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ allowed: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
