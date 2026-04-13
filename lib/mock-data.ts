/**
 * Mock data for development walkthrough.
 * Lets you tap through every screen without a Supabase backend.
 */

import type { Profile } from '../stores/authStore';
import type { Post } from '../stores/feedStore';
import type { PulseTopic, PulseStatement } from '../stores/pulseStore';
import type { BridgeSession, BridgeMessage, BridgePrompt } from '../hooks/useBridge';

// ── Profiles ──

export const MOCK_USER: Profile = {
  id: 'user-001',
  username: 'cameron',
  display_name: 'Cameron',
  avatar_url: null,
  birth_year: 1992,
  location_region: 'Massachusetts',
  origin_story: 'Building things that bring people together.',
  trust_score: 0.45,
  cluster_id: 1,
  cluster_confidence: 0.62,
  is_verified: false,
  is_human_verified: true,
  is_suspended: false,
  suspension_reason: null,
  bot_score: 0,
  invite_count: 3,
  invited_by: null,
  phone_verified: false,
  behavioral_verified: true,
  pulse_votes_count: 12,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-13T00:00:00Z',
};

const MOCK_AUTHORS: Record<string, Post['author']> = {
  'user-002': { username: 'elena_r', display_name: 'Elena Rodriguez', avatar_url: null, cluster_id: 4 },
  'user-003': { username: 'james_h', display_name: 'James Hartwell', avatar_url: null, cluster_id: 3 },
  'user-004': { username: 'priya_s', display_name: 'Priya Shah', avatar_url: null, cluster_id: 2 },
  'user-005': { username: 'marcus_t', display_name: 'Marcus Thompson', avatar_url: null, cluster_id: 5 },
  'user-006': { username: 'sarah_k', display_name: 'Sarah Kim', avatar_url: null, cluster_id: 1 },
  'user-007': { username: 'david_w', display_name: 'David Washington', avatar_url: null, cluster_id: 2 },
};

// ── Feed Posts ──

export const MOCK_POSTS: Post[] = [
  {
    id: 'post-001',
    author_id: 'user-002',
    content: 'Started a community garden on our block. Three neighbors I had never spoken to showed up with seeds. Sometimes the simplest thing brings people out.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.87,
    total_engagements: 142,
    cluster_reach: 5,
    cross_cluster_ratio: 0.78,
    topic_tags: ['Outdoors & Nature', 'Local Community'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-13T08:30:00Z',
    author: MOCK_AUTHORS['user-002'],
    user_engagements: ['agree'],
  },
  {
    id: 'post-002',
    author_id: 'user-003',
    content: 'My grandfather taught me to fish. My daughter teaches me about AI. Both of us just want to understand the world a little better. That never changes.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.93,
    total_engagements: 287,
    cluster_reach: 6,
    cross_cluster_ratio: 0.85,
    topic_tags: ['Parenting & Family', 'Tech & Gadgets'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-13T06:15:00Z',
    author: MOCK_AUTHORS['user-003'],
    user_engagements: ['agree', 'bridge'],
  },
  {
    id: 'post-003',
    author_id: 'user-004',
    content: 'Had a Bridge conversation with someone 30 years older than me. We disagree on almost everything but we both love this neighborhood. That was enough.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.72,
    total_engagements: 89,
    cluster_reach: 4,
    cross_cluster_ratio: 0.65,
    topic_tags: ['Local Community'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-13T04:45:00Z',
    author: MOCK_AUTHORS['user-004'],
    user_engagements: [],
  },
  {
    id: 'post-004',
    author_id: 'user-005',
    content: 'Best trail I have ever run. 6am. Nobody else around. Just me and the fog. Sometimes you need to disconnect to connect with yourself.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.81,
    total_engagements: 203,
    cluster_reach: 5,
    cross_cluster_ratio: 0.72,
    topic_tags: ['Fitness & Health', 'Outdoors & Nature'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-12T22:00:00Z',
    author: MOCK_AUTHORS['user-005'],
    user_engagements: ['important'],
  },
  {
    id: 'post-005',
    author_id: 'user-006',
    content: 'I used to think people who were different from me had nothing to offer. Then I sat down with one. Turns out we just had different information and different experiences. Obvious in hindsight.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.68,
    total_engagements: 156,
    cluster_reach: 4,
    cross_cluster_ratio: 0.61,
    topic_tags: ['Books & Learning'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-12T18:30:00Z',
    author: MOCK_AUTHORS['user-006'],
    user_engagements: ['agree'],
  },
  {
    id: 'post-006',
    author_id: 'user-007',
    content: 'Our local coffee shop started a "buy a stranger a coffee" board. It is full every morning. People are better than the internet makes them seem.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.76,
    total_engagements: 94,
    cluster_reach: 5,
    cross_cluster_ratio: 0.7,
    topic_tags: ['Food & Cooking', 'Local Community'],
    is_position: false,
    position_claim: null,
    position_steelman: null,
    position_common_ground: null,
    created_at: '2026-04-12T14:00:00Z',
    author: MOCK_AUTHORS['user-007'],
    user_engagements: [],
  },
];

// ── Pulse Topics ──

export const MOCK_TOPICS: PulseTopic[] = [
  {
    id: 'topic-001',
    title: 'What makes a great neighborhood?',
    description: 'What would make your block better?',
    category: 'Community',
    is_active: true,
    created_at: '2026-04-12T00:00:00Z',
    expires_at: null,
    voter_count: 1243,
    statement_count: 18,
  },
  {
    id: 'topic-002',
    title: 'Best way to meet people in a new city?',
    description: 'Moving somewhere new is hard. What worked for you?',
    category: 'Life',
    is_active: true,
    created_at: '2026-04-11T00:00:00Z',
    expires_at: null,
    voter_count: 2891,
    statement_count: 34,
  },
  {
    id: 'topic-003',
    title: 'Should phones be allowed at the dinner table?',
    description: 'Family rules. Where do you draw the line?',
    category: 'Family',
    is_active: true,
    created_at: '2026-04-10T00:00:00Z',
    expires_at: null,
    voter_count: 876,
    statement_count: 12,
  },
  {
    id: 'topic-004',
    title: 'What is one thing your community does right?',
    description: 'Not complaints. What works where you live?',
    category: 'Community',
    is_active: true,
    created_at: '2026-04-09T00:00:00Z',
    expires_at: null,
    voter_count: 1567,
    statement_count: 42,
  },
];

// ── Pulse Statements ──

export const MOCK_STATEMENTS: Record<string, PulseStatement[]> = {
  'topic-001': [
    { id: 'stmt-001', topic_id: 'topic-001', text: 'Walkability. If you can walk to a coffee shop and a park, you have a great neighborhood.', submitted_by: 'user-004', agree_count: 412, disagree_count: 89, pass_count: 34, bridging_score: 0.82, created_at: '2026-04-12T01:00:00Z' },
    { id: 'stmt-002', topic_id: 'topic-001', text: 'Knowing your neighbors by name. That is the whole thing.', submitted_by: 'user-003', agree_count: 523, disagree_count: 41, pass_count: 22, bridging_score: 0.91, created_at: '2026-04-12T02:00:00Z' },
    { id: 'stmt-003', topic_id: 'topic-001', text: 'Safety. You should be able to walk home at night without thinking about it.', submitted_by: 'user-005', agree_count: 487, disagree_count: 56, pass_count: 12, bridging_score: 0.88, created_at: '2026-04-12T03:00:00Z' },
    { id: 'stmt-004', topic_id: 'topic-001', text: 'A good local restaurant that everyone goes to. The kind of place where the owner knows your order.', submitted_by: 'user-002', agree_count: 345, disagree_count: 23, pass_count: 56, bridging_score: 0.87, created_at: '2026-04-12T04:00:00Z' },
  ],
  'topic-002': [
    { id: 'stmt-005', topic_id: 'topic-002', text: 'Join something recurring. A gym class, a book club, a running group. Regularity creates relationships.', submitted_by: 'user-005', agree_count: 678, disagree_count: 34, pass_count: 45, bridging_score: 0.91, created_at: '2026-04-11T01:00:00Z' },
    { id: 'stmt-006', topic_id: 'topic-002', text: 'Talk to people at coffee shops. Not on apps. Real life first.', submitted_by: 'user-002', agree_count: 456, disagree_count: 167, pass_count: 23, bridging_score: 0.68, created_at: '2026-04-11T02:00:00Z' },
    { id: 'stmt-007', topic_id: 'topic-002', text: 'Volunteer somewhere. You meet people who care about the same things.', submitted_by: 'user-006', agree_count: 734, disagree_count: 34, pass_count: 12, bridging_score: 0.93, created_at: '2026-04-11T03:00:00Z' },
  ],
  'topic-003': [
    { id: 'stmt-008', topic_id: 'topic-003', text: 'No phones at dinner. Period. It is the one hour a day you have together.', submitted_by: 'user-004', agree_count: 345, disagree_count: 178, pass_count: 34, bridging_score: 0.56, created_at: '2026-04-10T01:00:00Z' },
    { id: 'stmt-009', topic_id: 'topic-003', text: 'Depends on the situation. Showing someone a photo or looking up a fact is fine. Scrolling is not.', submitted_by: 'user-003', agree_count: 512, disagree_count: 67, pass_count: 45, bridging_score: 0.82, created_at: '2026-04-10T02:00:00Z' },
  ],
  'topic-004': [
    { id: 'stmt-010', topic_id: 'topic-004', text: 'Our farmers market. Every Saturday. People from completely different walks of life standing in the same line for tomatoes.', submitted_by: 'user-007', agree_count: 567, disagree_count: 23, pass_count: 11, bridging_score: 0.93, created_at: '2026-04-09T01:00:00Z' },
    { id: 'stmt-011', topic_id: 'topic-004', text: 'The library. Free. Open to everyone. No one asks who you are or what you believe.', submitted_by: 'user-002', agree_count: 489, disagree_count: 15, pass_count: 19, bridging_score: 0.91, created_at: '2026-04-09T02:00:00Z' },
  ],
};

// ── Bridge Sessions ──

export const MOCK_BRIDGE_PROMPTS: BridgePrompt[] = [
  { id: 'p1', text: 'What do you value most about where you live?', order: 1 },
  { id: 'p2', text: 'What is something most people get wrong about you?', order: 2 },
  { id: 'p3', text: 'Where do you think we actually agree?', order: 3 },
];

export const MOCK_BRIDGE_SESSIONS: BridgeSession[] = [
  {
    id: 'bridge-001',
    user_a_id: 'user-001',
    user_b_id: 'user-003',
    topic_id: 'topic-001',
    status: 'active',
    match_score: 0.82,
    prompt_sequence: MOCK_BRIDGE_PROMPTS,
    started_at: '2026-04-12T10:00:00Z',
    completed_at: null,
    created_at: '2026-04-12T09:00:00Z',
    partner: { display_name: 'James Hartwell', avatar_url: null, cluster_id: 3, birth_year: 1968 },
    topic: { title: 'What makes a great neighborhood?' },
  },
  {
    id: 'bridge-002',
    user_a_id: 'user-005',
    user_b_id: 'user-001',
    topic_id: 'topic-002',
    status: 'pending',
    match_score: 0.74,
    prompt_sequence: MOCK_BRIDGE_PROMPTS,
    started_at: null,
    completed_at: null,
    created_at: '2026-04-13T07:00:00Z',
    partner: { display_name: 'Marcus Thompson', avatar_url: null, cluster_id: 5, birth_year: 1985 },
    topic: { title: 'Best way to meet people in a new city?' },
  },
];

export const MOCK_BRIDGE_MESSAGES: Record<string, BridgeMessage[]> = {
  'bridge-001': [
    { id: 'msg-001', session_id: 'bridge-001', sender_id: 'user-003', content: 'I value the quiet. The fact that I know every dog on my street by name. The routine of it. That is what makes a place feel like home.', prompt_id: 'p1', created_at: '2026-04-12T11:00:00Z' },
    { id: 'msg-002', session_id: 'bridge-001', sender_id: 'user-001', content: 'That resonates. For me it is the coffee shop where they know my order. Small thing but it means someone sees you.', prompt_id: 'p1', created_at: '2026-04-12T14:30:00Z' },
    { id: 'msg-003', session_id: 'bridge-001', sender_id: 'user-003', content: 'People assume I do not like change because I have lived here 30 years. That is not it. I just think change should serve the people already here, not replace them.', prompt_id: 'p2', created_at: '2026-04-13T08:00:00Z' },
  ],
};

// ── Cluster Map Points ──

export function generateMockClusterPoints(count: number = 60) {
  const points = [];
  const clusterCenters = [
    { x: 0.3, y: 0.3, id: 1 },
    { x: 0.7, y: 0.2, id: 2 },
    { x: 0.2, y: 0.7, id: 3 },
    { x: 0.8, y: 0.6, id: 4 },
    { x: 0.5, y: 0.5, id: 5 },
  ];

  for (let i = 0; i < count; i++) {
    const center = clusterCenters[i % clusterCenters.length];
    points.push({
      x: Math.max(0, Math.min(1, center.x + (Math.random() - 0.5) * 0.2)),
      y: Math.max(0, Math.min(1, center.y + (Math.random() - 0.5) * 0.2)),
      clusterId: center.id,
    });
  }
  return points;
}
