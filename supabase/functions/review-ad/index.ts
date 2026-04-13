import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Ad review Edge Function.
 *
 * Two modes:
 * 1. On-demand: POST with { campaignId } — runs bridging score check on an active ad
 * 2. Cron (every 30 min): checks all active ads against policy rules
 *
 * Core principle: ads that only resonate with one cluster get paused.
 * HereToo does not accept divisive advertising.
 */

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Load policy rules
  const { data: rules } = await supabase
    .from('ad_policy_rules')
    .select('*')
    .eq('is_active', true);

  const ruleMap = new Map(
    (rules ?? []).map((r: any) => [r.rule_name, r])
  );

  // Get all active campaigns
  const { data: activeCampaigns } = await supabase
    .from('ad_campaigns')
    .select('*')
    .eq('status', 'active');

  let reviewed = 0;
  let paused = 0;

  for (const campaign of activeCampaigns ?? []) {
    // Get impressions for this campaign
    const { data: impressions } = await supabase
      .from('ad_impressions')
      .select('user_cluster_id, engagement_type')
      .eq('campaign_id', campaign.id);

    if (!impressions || impressions.length < 50) continue; // Need minimum data
    reviewed++;

    const totalImpressions = impressions.length;
    const views = impressions.filter((i: any) => i.engagement_type === 'view').length;
    const agrees = impressions.filter((i: any) => i.engagement_type === 'agree').length;
    const disagrees = impressions.filter((i: any) => i.engagement_type === 'disagree').length;
    const flags = impressions.filter((i: any) => i.engagement_type === 'flag').length;

    // Calculate cluster distribution of positive engagement
    const positiveByCluster = new Map<number, number>();
    for (const imp of impressions) {
      if (imp.engagement_type === 'agree' || imp.engagement_type === 'click') {
        const cluster = imp.user_cluster_id ?? 0;
        positiveByCluster.set(cluster, (positiveByCluster.get(cluster) ?? 0) + 1);
      }
    }

    const totalPositive = [...positiveByCluster.values()].reduce((a, b) => a + b, 0);
    const clusterReach = positiveByCluster.size;

    // Bridging score for the ad
    const totalClusters = 6;
    const clusterDiversity = clusterReach > 0
      ? (clusterReach - 1) / (totalClusters - 1)
      : 0;

    // Single cluster dominance
    const maxClusterRatio = totalPositive > 0
      ? Math.max(...positiveByCluster.values()) / totalPositive
      : 0;

    const disagreeRatio = (agrees + disagrees) > 0
      ? disagrees / (agrees + disagrees)
      : 0;

    const flagRate = totalImpressions > 0
      ? flags / totalImpressions
      : 0;

    const bridgingScore = clusterDiversity;
    const divisiveness = 1.0 - bridgingScore;

    // Check each policy rule
    let shouldPause = false;
    let shouldReject = false;
    let violationReasons: string[] = [];

    // Rule: min_bridging_score
    const minBridging = ruleMap.get('min_bridging_score');
    if (minBridging && bridgingScore < (minBridging.threshold ?? 0.3) && totalImpressions >= 100) {
      if (minBridging.action === 'pause') shouldPause = true;
      if (minBridging.action === 'reject') shouldReject = true;
      violationReasons.push(`Bridging score ${bridgingScore.toFixed(2)} below minimum ${minBridging.threshold}`);
    }

    // Rule: max_single_cluster_ratio
    const maxCluster = ruleMap.get('max_single_cluster_ratio');
    if (maxCluster && maxClusterRatio > (maxCluster.threshold ?? 0.8)) {
      if (maxCluster.action === 'pause') shouldPause = true;
      violationReasons.push(`Single cluster dominance ${(maxClusterRatio * 100).toFixed(0)}% exceeds ${(maxCluster.threshold ?? 0.8) * 100}%`);
    }

    // Rule: max_disagree_ratio
    const maxDisagree = ruleMap.get('max_disagree_ratio');
    if (maxDisagree && disagreeRatio > (maxDisagree.threshold ?? 0.6)) {
      shouldPause = true;
      violationReasons.push(`Disagree ratio ${(disagreeRatio * 100).toFixed(0)}% exceeds threshold`);
    }

    // Rule: max_flag_rate
    const maxFlags = ruleMap.get('max_flag_rate');
    if (maxFlags && flagRate > (maxFlags.threshold ?? 0.05)) {
      shouldReject = true;
      violationReasons.push(`Flag rate ${(flagRate * 100).toFixed(1)}% exceeds maximum`);
    }

    // Update campaign metrics
    const updates: Record<string, any> = {
      bridging_score: Math.round(bridgingScore * 1000) / 1000,
      cluster_reach: clusterReach,
      divisiveness_score: Math.round(divisiveness * 1000) / 1000,
    };

    if (shouldReject) {
      updates.status = 'rejected';
      updates.rejection_reason = violationReasons.join('; ');
      paused++;
    } else if (shouldPause) {
      updates.status = 'paused';
      updates.rejection_reason = violationReasons.join('; ');
      paused++;
    }

    await supabase
      .from('ad_campaigns')
      .update(updates)
      .eq('id', campaign.id);
  }

  return new Response(
    JSON.stringify({ reviewed, paused }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
