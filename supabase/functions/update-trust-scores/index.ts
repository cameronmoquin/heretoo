import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active users (with posts or engagements in last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: activeUsers } = await supabase
    .from('profiles')
    .select('id')
    .gte('updated_at', thirtyDaysAgo);

  let updated = 0;

  for (const user of activeUsers ?? []) {
    // Factor 1: Bridge completions (0-0.3)
    const { count: bridgeCompletions } = await supabase
      .from('bridge_sessions')
      .select('*', { count: 'exact', head: true })
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq('status', 'completed');

    const bridgeScore = Math.min(0.3, (bridgeCompletions ?? 0) * 0.05);

    // Factor 2: Average bridging score of their posts (0-0.3)
    const { data: posts } = await supabase
      .from('posts')
      .select('bridging_score')
      .eq('author_id', user.id)
      .gt('total_engagements', 2);

    const avgBridging =
      posts && posts.length > 0
        ? posts.reduce((sum: number, p: any) => sum + p.bridging_score, 0) /
          posts.length
        : 0;
    const contentScore = avgBridging * 0.3;

    // Factor 3: Pulse participation (0-0.2)
    const { count: voteCount } = await supabase
      .from('pulse_votes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const participationScore = Math.min(0.2, (voteCount ?? 0) * 0.004);

    // Factor 4: Account age (0-0.15)
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', user.id)
      .single();

    const accountAgeDays = profile
      ? (Date.now() - new Date(profile.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      : 0;
    const ageScore = Math.min(0.15, accountAgeDays / 365 * 0.15);

    // Factor 5: Invite bonus (0-0.15)
    // +0.02 per accepted invite, capped at 0.15
    const { count: acceptedInvites } = await supabase
      .from('invites')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', user.id)
      .not('accepted_by', 'is', null);

    const inviteScore = Math.min(0.15, (acceptedInvites ?? 0) * 0.02);

    // Mark trust bonuses as awarded
    if ((acceptedInvites ?? 0) > 0) {
      await supabase
        .from('invites')
        .update({ trust_bonus_awarded: true })
        .eq('inviter_id', user.id)
        .eq('trust_bonus_awarded', false)
        .not('accepted_by', 'is', null);
    }

    // Total trust score
    const trustScore = Math.min(
      1.0,
      bridgeScore + contentScore + participationScore + ageScore + inviteScore
    );

    await supabase
      .from('profiles')
      .update({ trust_score: Math.round(trustScore * 100) / 100 })
      .eq('id', user.id);

    await supabase.from('trust_score_history').insert({
      user_id: user.id,
      score: trustScore,
      reason: `bridge:${bridgeScore.toFixed(2)} content:${contentScore.toFixed(2)} participation:${participationScore.toFixed(2)} age:${ageScore.toFixed(2)} invites:${inviteScore.toFixed(2)}`,
    });

    updated++;
  }

  return new Response(
    JSON.stringify({ updated }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
