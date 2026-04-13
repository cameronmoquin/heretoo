import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const totalClusters = 6;

  // Get all posts with engagements in last 24 hours
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, author_id')
    .gte('updated_at', new Date(Date.now() - 86400000).toISOString());

  let updated = 0;

  for (const post of recentPosts ?? []) {
    // Get all engagements with engager cluster info
    const { data: engagements } = await supabase
      .from('engagements')
      .select('user_id, profiles(cluster_id)')
      .eq('post_id', post.id);

    // Get author cluster
    const { data: author } = await supabase
      .from('profiles')
      .select('cluster_id')
      .eq('id', post.author_id)
      .single();

    if (!engagements || engagements.length === 0) continue;

    // Calculate cluster diversity
    const clusterIds = engagements
      .map((e: any) => e.profiles?.cluster_id)
      .filter(Boolean);
    const distinctClusters = new Set(clusterIds).size;
    const clusterDiversityScore = Math.max(
      0,
      (distinctClusters - 1) / (totalClusters - 1)
    );

    // Calculate cross-cluster ratio
    const authorCluster = author?.cluster_id;
    const crossClusterEngagements = clusterIds.filter(
      (c: number) => c !== authorCluster
    ).length;
    const crossClusterRatio = crossClusterEngagements / engagements.length;

    // Final bridging score
    const bridgingScore =
      clusterDiversityScore * 0.6 + crossClusterRatio * 0.4;

    // Update post
    await supabase
      .from('posts')
      .update({
        bridging_score: bridgingScore,
        cluster_reach: distinctClusters,
        cross_cluster_ratio: crossClusterRatio,
        total_engagements: engagements.length,
      })
      .eq('id', post.id);

    // Log history
    await supabase.from('bridging_score_history').insert({
      post_id: post.id,
      score: bridgingScore,
      cluster_breakdown: { distinctClusters, crossClusterRatio },
    });

    updated++;
  }

  return new Response(
    JSON.stringify({ updated, total: recentPosts?.length ?? 0 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
