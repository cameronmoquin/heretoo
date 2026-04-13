import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get the requesting user from the JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get requesting user's profile
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userProfile) {
    return new Response('Profile not found', { status: 404 });
  }

  // Get candidate users:
  // - Different cluster
  // - Trust score within 0.2
  // - Not already matched on any active topic
  const { data: candidates } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id)
    .neq('cluster_id', userProfile.cluster_id)
    .gte('trust_score', Math.max(0, userProfile.trust_score - 0.2))
    .lte('trust_score', Math.min(1, userProfile.trust_score + 0.2))
    .limit(50);

  if (!candidates || candidates.length === 0) {
    return new Response(
      JSON.stringify({ match: null, message: 'No matches found right now. Try again later.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get existing sessions to exclude
  const { data: existingSessions } = await supabase
    .from('bridge_sessions')
    .select('user_a_id, user_b_id')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .in('status', ['pending', 'active']);

  const excludeIds = new Set(
    (existingSessions ?? []).flatMap((s: any) => [s.user_a_id, s.user_b_id])
  );

  // Score each candidate
  const scored = candidates
    .filter((c: any) => !excludeIds.has(c.id))
    .map((candidate: any) => {
      const clusterDistance =
        candidate.cluster_id !== userProfile.cluster_id ? 1.0 : 0.0;
      const yearGap = Math.abs(
        (candidate.birth_year ?? 1990) - (userProfile.birth_year ?? 1990)
      );
      const generationDistance = Math.min(1.0, yearGap / 40);
      const trustSimilarity =
        1.0 - Math.abs(candidate.trust_score - userProfile.trust_score);

      const matchScore =
        clusterDistance * 0.4 +
        generationDistance * 0.3 +
        trustSimilarity * 0.3;

      return { candidate, matchScore };
    })
    .sort((a: any, b: any) => b.matchScore - a.matchScore);

  if (scored.length === 0) {
    return new Response(
      JSON.stringify({ match: null, message: 'No eligible matches right now.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const best = scored[0];

  // Find a shared topic (any active topic both users have voted on)
  const { data: sharedTopics } = await supabase.rpc('find_shared_topics', {
    user_a: user.id,
    user_b: best.candidate.id,
  });

  const topicId = sharedTopics?.[0]?.topic_id ?? null;

  // Create bridge session
  const defaultPrompts = [
    { id: 'p1', text: 'What does your community value most?', order: 1 },
    {
      id: 'p2',
      text: "What's something you wish the other side understood about your perspective?",
      order: 2,
    },
    {
      id: 'p3',
      text: 'Where do you think we might actually agree?',
      order: 3,
    },
  ];

  const { data: session, error } = await supabase
    .from('bridge_sessions')
    .insert({
      user_a_id: user.id,
      user_b_id: best.candidate.id,
      topic_id: topicId,
      match_score: best.matchScore,
      prompt_sequence: defaultPrompts,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ match: session }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
