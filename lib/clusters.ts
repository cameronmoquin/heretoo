import type { InterestTopic } from '../constants/clusters';

/**
 * Initial cluster assignment based on topic interests selected during onboarding.
 * This is a simplified heuristic — the real cluster emerges from voting patterns over time.
 *
 * Maps interest combinations to initial cluster suggestions.
 */

const TOPIC_CLUSTER_WEIGHTS: Record<InterestTopic, Record<number, number>> = {
  'Economy & Jobs':     { 1: 0.3, 2: 0.1, 3: 0.2, 4: 0.1, 5: 0.3 },
  'Education':          { 1: 0.2, 2: 0.3, 3: 0.1, 4: 0.3, 5: 0.1 },
  'Environment':        { 1: 0.1, 2: 0.2, 3: 0.0, 4: 0.5, 5: 0.2 },
  'Healthcare':         { 1: 0.2, 2: 0.3, 3: 0.1, 4: 0.3, 5: 0.1 },
  'Housing':            { 1: 0.2, 2: 0.3, 3: 0.1, 4: 0.2, 5: 0.2 },
  'Immigration':        { 1: 0.2, 2: 0.1, 3: 0.3, 4: 0.2, 5: 0.2 },
  'Public Safety':      { 1: 0.2, 2: 0.2, 3: 0.3, 4: 0.1, 5: 0.2 },
  'Technology':         { 1: 0.2, 2: 0.1, 3: 0.1, 4: 0.3, 5: 0.3 },
  'Civil Rights':       { 1: 0.1, 2: 0.2, 3: 0.1, 4: 0.4, 5: 0.2 },
  'Local Government':   { 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.1 },
  'Arts & Culture':     { 1: 0.1, 2: 0.3, 3: 0.2, 4: 0.3, 5: 0.1 },
  'Transportation':     { 1: 0.3, 2: 0.2, 3: 0.1, 4: 0.2, 5: 0.2 },
};

/**
 * Given 3 selected interest topics, compute an initial cluster assignment.
 * Returns the cluster_id (1–5) with the highest combined weight.
 * If tied, defaults to pragmatic_center (1).
 */
export function assignInitialCluster(interests: InterestTopic[]): {
  clusterId: number;
  confidence: number;
} {
  const scores: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const topic of interests) {
    const weights = TOPIC_CLUSTER_WEIGHTS[topic];
    if (!weights) continue;
    for (const [clusterId, weight] of Object.entries(weights)) {
      scores[Number(clusterId)] += weight;
    }
  }

  let maxScore = 0;
  let bestCluster = 1;
  for (const [clusterId, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCluster = Number(clusterId);
    }
  }

  // Confidence = how much the top cluster stands out (0–1)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  return { clusterId: bestCluster, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Calculate match score between two users for Bridge matching.
 *
 * match_score = (cluster_distance * 0.4) + (generation_distance * 0.3) + (trust_similarity * 0.3)
 */
export function calculateMatchScore(
  userA: { clusterId: number; birthYear: number; trustScore: number },
  userB: { clusterId: number; birthYear: number; trustScore: number }
): number {
  // Cluster distance: 0 = same, 1 = different
  const clusterDistance = userA.clusterId !== userB.clusterId ? 1.0 : 0.0;

  // Generation distance: normalized 0–1, max useful gap = 40 years
  const yearGap = Math.abs(userA.birthYear - userB.birthYear);
  const generationDistance = Math.min(1.0, yearGap / 40);

  // Trust similarity: 1.0 - |trust_a - trust_b|
  const trustSimilarity = 1.0 - Math.abs(userA.trustScore - userB.trustScore);

  return clusterDistance * 0.4 + generationDistance * 0.3 + trustSimilarity * 0.3;
}
