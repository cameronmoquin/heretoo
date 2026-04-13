import type { InterestTopic } from '../constants/clusters';

/**
 * Initial cluster assignment based on topic interests selected during onboarding.
 * Clusters represent personality/community styles, not political identities.
 * The real cluster emerges from engagement patterns over time.
 */

const TOPIC_CLUSTER_WEIGHTS: Record<InterestTopic, Record<number, number>> = {
  'Food & Cooking':     { 1: 0.2, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.2 },
  'Fitness & Health':   { 1: 0.2, 2: 0.1, 3: 0.1, 4: 0.3, 5: 0.3 },
  'Music':              { 1: 0.1, 2: 0.3, 3: 0.1, 4: 0.3, 5: 0.2 },
  'Sports':             { 1: 0.2, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.2 },
  'Outdoors & Nature':  { 1: 0.2, 2: 0.1, 3: 0.3, 4: 0.1, 5: 0.3 },
  'Tech & Gadgets':     { 1: 0.2, 2: 0.1, 3: 0.1, 4: 0.3, 5: 0.3 },
  'Books & Learning':   { 1: 0.2, 2: 0.2, 3: 0.1, 4: 0.3, 5: 0.2 },
  'Art & Design':       { 1: 0.1, 2: 0.3, 3: 0.1, 4: 0.4, 5: 0.1 },
  'Travel':             { 1: 0.2, 2: 0.2, 3: 0.1, 4: 0.2, 5: 0.3 },
  'Parenting & Family': { 1: 0.2, 2: 0.3, 3: 0.3, 4: 0.1, 5: 0.1 },
  'Pets':               { 1: 0.2, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.2 },
  'Local Community':    { 1: 0.3, 2: 0.3, 3: 0.2, 4: 0.1, 5: 0.1 },
};

/**
 * Given 3 selected interest topics, compute an initial cluster assignment.
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

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  return { clusterId: bestCluster, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Calculate match score between two users for Bridge matching.
 */
export function calculateMatchScore(
  userA: { clusterId: number; birthYear: number; trustScore: number },
  userB: { clusterId: number; birthYear: number; trustScore: number }
): number {
  const clusterDistance = userA.clusterId !== userB.clusterId ? 1.0 : 0.0;
  const yearGap = Math.abs(userA.birthYear - userB.birthYear);
  const generationDistance = Math.min(1.0, yearGap / 40);
  const trustSimilarity = 1.0 - Math.abs(userA.trustScore - userB.trustScore);

  return clusterDistance * 0.4 + generationDistance * 0.3 + trustSimilarity * 0.3;
}
