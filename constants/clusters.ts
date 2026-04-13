import { Colors } from './colors';

export interface ClusterDefinition {
  id: number;
  name: string;
  displayColor: string;
  description: string;
}

export const CLUSTERS: ClusterDefinition[] = [
  { id: 1, name: 'pragmatic_center', displayColor: Colors.clusters.pragmatic_center, description: 'Pragmatic Center' },
  { id: 2, name: 'community_focused', displayColor: Colors.clusters.community_focused, description: 'Community Focused' },
  { id: 3, name: 'tradition_minded', displayColor: Colors.clusters.tradition_minded, description: 'Tradition Minded' },
  { id: 4, name: 'reform_oriented', displayColor: Colors.clusters.reform_oriented, description: 'Reform Oriented' },
  { id: 5, name: 'liberty_focused', displayColor: Colors.clusters.liberty_focused, description: 'Liberty Focused' },
  { id: 6, name: 'unclassified', displayColor: Colors.clusters.unclassified, description: 'Unclassified' },
];

export const TOTAL_CLUSTERS = CLUSTERS.length;

export const CLUSTER_BY_ID = Object.fromEntries(
  CLUSTERS.map((c) => [c.id, c])
);

export const INTEREST_TOPICS = [
  'Economy & Jobs',
  'Education',
  'Environment',
  'Healthcare',
  'Housing',
  'Immigration',
  'Public Safety',
  'Technology',
  'Civil Rights',
  'Local Government',
  'Arts & Culture',
  'Transportation',
] as const;

export type InterestTopic = (typeof INTEREST_TOPICS)[number];
