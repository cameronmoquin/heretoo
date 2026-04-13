import { TOTAL_CLUSTERS } from '../constants/clusters';

/**
 * BRIDGING SCORE FORMULA:
 * bridging_score = (cluster_diversity_score * 0.6) + (cross_cluster_ratio * 0.4)
 *
 * cluster_diversity_score:
 *   Count distinct clusters that engaged → normalize: 1 cluster = 0.0, 6 = 1.0
 *
 * cross_cluster_ratio:
 *   % of engagements from clusters other than the author's
 */

export function calculateBridgingScore(
  engagementClusterIds: number[],
  authorClusterId: number
): {
  bridgingScore: number;
  clusterDiversityScore: number;
  crossClusterRatio: number;
  clusterReach: number;
} {
  if (engagementClusterIds.length === 0) {
    return { bridgingScore: 0, clusterDiversityScore: 0, crossClusterRatio: 0, clusterReach: 0 };
  }

  const distinctClusters = new Set(engagementClusterIds).size;
  const clusterDiversityScore = Math.max(0, (distinctClusters - 1) / (TOTAL_CLUSTERS - 1));

  const crossClusterEngagements = engagementClusterIds.filter(
    (c) => c !== authorClusterId
  ).length;
  const crossClusterRatio = crossClusterEngagements / engagementClusterIds.length;

  const bridgingScore = clusterDiversityScore * 0.6 + crossClusterRatio * 0.4;

  return {
    bridgingScore: Math.round(bridgingScore * 1000) / 1000,
    clusterDiversityScore,
    crossClusterRatio,
    clusterReach: distinctClusters,
  };
}

/**
 * FEED RANKING FORMULA:
 * final_rank = (bridging_score * 0.5) + (recency_score * 0.3) + (engagement_velocity * 0.2)
 *
 * recency_score: exponential decay, half-life 6 hours
 * engagement_velocity: engagements per hour in last 2 hours
 */

export function calculateFeedRank(
  bridgingScore: number,
  createdAt: Date,
  recentEngagementCount: number,
  now: Date = new Date()
): number {
  // Recency: exponential decay with 6-hour half-life
  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  const halfLife = 6;
  const recencyScore = Math.pow(0.5, ageHours / halfLife);

  // Engagement velocity: engagements per hour in last 2 hours (capped at 1.0)
  const engagementVelocity = Math.min(1.0, recentEngagementCount / 20);

  return bridgingScore * 0.5 + recencyScore * 0.3 + engagementVelocity * 0.2;
}

/**
 * Get the bridge score badge level based on cluster reach.
 */
export type BridgeBadgeLevel = 'local' | 'reaching' | 'bridging' | 'common_ground';

export function getBridgeBadgeLevel(clusterReach: number): BridgeBadgeLevel {
  if (clusterReach >= 6) return 'common_ground';
  if (clusterReach >= 4) return 'bridging';
  if (clusterReach >= 2) return 'reaching';
  return 'local';
}
