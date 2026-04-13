import { Colors } from './colors';

export interface ClusterDefinition {
  id: number;
  name: string;
  displayColor: string;
  description: string;
}

export const CLUSTERS: ClusterDefinition[] = [
  { id: 1, name: 'practical', displayColor: Colors.clusters.pragmatic_center, description: 'Practical' },
  { id: 2, name: 'connector', displayColor: Colors.clusters.community_focused, description: 'Connector' },
  { id: 3, name: 'roots', displayColor: Colors.clusters.tradition_minded, description: 'Roots' },
  { id: 4, name: 'builder', displayColor: Colors.clusters.reform_oriented, description: 'Builder' },
  { id: 5, name: 'independent', displayColor: Colors.clusters.liberty_focused, description: 'Independent' },
  { id: 6, name: 'new_here', displayColor: Colors.clusters.unclassified, description: 'New Here' },
];

export const TOTAL_CLUSTERS = CLUSTERS.length;

export const CLUSTER_BY_ID = Object.fromEntries(
  CLUSTERS.map((c) => [c.id, c])
);

export const INTEREST_TOPICS = [
  'Food & Cooking',
  'Fitness & Health',
  'Music',
  'Sports',
  'Outdoors & Nature',
  'Tech & Gadgets',
  'Books & Learning',
  'Art & Design',
  'Travel',
  'Parenting & Family',
  'Pets',
  'Local Community',
] as const;

export type InterestTopic = (typeof INTEREST_TOPICS)[number];
