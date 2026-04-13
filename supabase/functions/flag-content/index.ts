import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Content flagging Edge Function.
 * Handles user-submitted flags with cross-cluster validation.
 *
 * Key rule: a flag can only be upheld by a reviewer from a DIFFERENT cluster
 * than the flagger. This prevents one community from silencing another.
 */

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

  const body = await req.json();
  const { action } = body;

  // === CREATE FLAG ===
  if (action === 'create') {
    const { contentType, contentId, reason, description } = body;

    if (!contentType || !contentId || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_action: 'flag',
      p_max_count: 10,
      p_window_minutes: 60,
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limited — too many flags' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get flagger's cluster
    const { data: flagger } = await supabase
      .from('profiles')
      .select('cluster_id')
      .eq('id', user.id)
      .single();

    // Check for duplicate flag
    const { data: existing } = await supabase
      .from('content_flags')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('flagged_by', user.id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'You have already flagged this content' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: flag, error } = await supabase
      .from('content_flags')
      .insert({
        content_type: contentType,
        content_id: contentId,
        flagged_by: user.id,
        flagger_cluster_id: flagger?.cluster_id,
        reason,
        description: description ?? null,
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if this content has been flagged multiple times — auto-escalate
    const { count: flagCount } = await supabase
      .from('content_flags')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', contentType)
      .eq('content_id', contentId);

    // Auto-escalate if 3+ flags from different clusters
    if ((flagCount ?? 0) >= 3) {
      const { data: flags } = await supabase
        .from('content_flags')
        .select('flagger_cluster_id')
        .eq('content_type', contentType)
        .eq('content_id', contentId);

      const uniqueClusters = new Set(
        (flags ?? []).map((f: any) => f.flagger_cluster_id).filter(Boolean)
      );

      if (uniqueClusters.size >= 2) {
        // Multi-cluster flags = escalate to review
        await supabase
          .from('content_flags')
          .update({ status: 'under_review' })
          .eq('content_type', contentType)
          .eq('content_id', contentId)
          .eq('status', 'pending');
      }
    }

    return new Response(
      JSON.stringify({ flag }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // === APPEAL ===
  if (action === 'appeal') {
    const { flagId, appealText } = body;

    if (!flagId || !appealText) {
      return new Response(
        JSON.stringify({ error: 'Missing flagId or appealText' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: appeal, error } = await supabase
      .from('moderation_appeals')
      .insert({
        flag_id: flagId,
        appellant_id: user.id,
        appeal_text: appealText,
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ appeal }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Invalid action' }),
    { status: 400, headers: { 'Content-Type': 'application/json' } }
  );
});
