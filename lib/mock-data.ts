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
  origin_story: 'Building tech that brings people together instead of tearing them apart.',
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
    content: 'I think the biggest thing we all agree on is that housing costs are out of control. Doesn\'t matter if you\'re left, right, or center — nobody can afford to live where they work anymore.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.87,
    total_engagements: 142,
    cluster_reach: 5,
    cross_cluster_ratio: 0.78,
    topic_tags: ['Housing', 'Economy & Jobs'],
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
    content: 'My grandfather was a coal miner. My daughter wants to work in renewable energy. Both of them just want to provide for their families. That\'s common ground.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.93,
    total_engagements: 287,
    cluster_reach: 6,
    cross_cluster_ratio: 0.85,
    topic_tags: ['Economy & Jobs', 'Environment'],
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
    content: 'Just had a Bridge conversation with someone 30 years older than me from a completely different background. We disagreed on a lot, but we both care about the same neighborhood. That\'s what this app is for.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.72,
    total_engagements: 89,
    cluster_reach: 4,
    cross_cluster_ratio: 0.65,
    topic_tags: ['Local Government'],
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
    content: 'Unpopular opinion: we spend too much time debating national politics and not enough time showing up to local school board meetings. The stuff that actually affects your kids happens at the local level.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.81,
    total_engagements: 203,
    cluster_reach: 5,
    cross_cluster_ratio: 0.72,
    topic_tags: ['Education', 'Local Government'],
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
    content: 'I used to think people on the other side were crazy. Then I actually listened. They\'re not crazy — they just have different information and different life experiences. Obvious in hindsight.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.68,
    total_engagements: 156,
    cluster_reach: 4,
    cross_cluster_ratio: 0.61,
    topic_tags: ['Civil Rights'],
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
    content: 'Local businesses are the one thing every political group in my town supports. We did a community buy-local pledge and got signatures from people across the entire spectrum. Start where you agree.',
    media_type: 'none',
    photo_urls: null,
    mux_playback_id: null,
    mux_thumbnail_url: null,
    video_duration_seconds: null,
    bridging_score: 0.76,
    total_engagements: 94,
    cluster_reach: 5,
    cross_cluster_ratio: 0.7,
    topic_tags: ['Economy & Jobs', 'Local Government'],
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
    title: 'Should cities invest more in public transit or road infrastructure?',
    description: 'Your city has $500M to spend. Where should it go?',
    category: 'Transportation',
    is_active: true,
    created_at: '2026-04-12T00:00:00Z',
    expires_at: null,
    voter_count: 1243,
    statement_count: 18,
  },
  {
    id: 'topic-002',
    title: 'What\'s the biggest barrier to affordable housing?',
    description: 'Vote on what\'s actually blocking housing in your area.',
    category: 'Housing',
    is_active: true,
    created_at: '2026-04-11T00:00:00Z',
    expires_at: null,
    voter_count: 2891,
    statement_count: 34,
  },
  {
    id: 'topic-003',
    title: 'How should schools teach kids about technology?',
    description: 'Phones in class, coding curriculum, AI literacy — what matters most?',
    category: 'Education',
    is_active: true,
    created_at: '2026-04-10T00:00:00Z',
    expires_at: null,
    voter_count: 876,
    statement_count: 12,
  },
  {
    id: 'topic-004',
    title: 'What does your community need most right now?',
    description: 'Think local. What would make the biggest difference on your block?',
    category: 'Local Government',
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
    { id: 'stmt-001', topic_id: 'topic-001', text: 'Public transit reduces traffic for everyone, even people who drive.', submitted_by: 'user-004', agree_count: 412, disagree_count: 89, pass_count: 34, bridging_score: 0.82, created_at: '2026-04-12T01:00:00Z' },
    { id: 'stmt-002', topic_id: 'topic-001', text: 'Rural areas need roads — transit only works in dense cities.', submitted_by: 'user-003', agree_count: 287, disagree_count: 156, pass_count: 67, bridging_score: 0.54, created_at: '2026-04-12T02:00:00Z' },
    { id: 'stmt-003', topic_id: 'topic-001', text: 'We should fix existing roads and bridges before building anything new.', submitted_by: 'user-005', agree_count: 523, disagree_count: 41, pass_count: 22, bridging_score: 0.91, created_at: '2026-04-12T03:00:00Z' },
    { id: 'stmt-004', topic_id: 'topic-001', text: 'Bike lanes and walkability should be part of every transit plan.', submitted_by: 'user-002', agree_count: 345, disagree_count: 123, pass_count: 56, bridging_score: 0.67, created_at: '2026-04-12T04:00:00Z' },
  ],
  'topic-002': [
    { id: 'stmt-005', topic_id: 'topic-002', text: 'Zoning laws are the #1 barrier. We need to allow more building.', submitted_by: 'user-005', agree_count: 678, disagree_count: 201, pass_count: 45, bridging_score: 0.71, created_at: '2026-04-11T01:00:00Z' },
    { id: 'stmt-006', topic_id: 'topic-002', text: 'Corporate landlords buying up single-family homes is the real problem.', submitted_by: 'user-002', agree_count: 891, disagree_count: 67, pass_count: 23, bridging_score: 0.88, created_at: '2026-04-11T02:00:00Z' },
    { id: 'stmt-007', topic_id: 'topic-002', text: 'We need both more supply AND renter protections. It\'s not either/or.', submitted_by: 'user-006', agree_count: 934, disagree_count: 34, pass_count: 12, bridging_score: 0.95, created_at: '2026-04-11T03:00:00Z' },
  ],
  'topic-003': [
    { id: 'stmt-008', topic_id: 'topic-003', text: 'Kids should learn to code, but also learn to think critically about the code that runs their lives.', submitted_by: 'user-004', agree_count: 234, disagree_count: 12, pass_count: 8, bridging_score: 0.89, created_at: '2026-04-10T01:00:00Z' },
    { id: 'stmt-009', topic_id: 'topic-003', text: 'Phones should be banned during class time. No exceptions.', submitted_by: 'user-003', agree_count: 345, disagree_count: 178, pass_count: 34, bridging_score: 0.56, created_at: '2026-04-10T02:00:00Z' },
  ],
  'topic-004': [
    { id: 'stmt-010', topic_id: 'topic-004', text: 'More third places — libraries, parks, community centers — where people can actually meet.', submitted_by: 'user-007', agree_count: 567, disagree_count: 23, pass_count: 11, bridging_score: 0.93, created_at: '2026-04-09T01:00:00Z' },
    { id: 'stmt-011', topic_id: 'topic-004', text: 'Better mental health access. The waitlists are months long.', submitted_by: 'user-002', agree_count: 489, disagree_count: 15, pass_count: 19, bridging_score: 0.91, created_at: '2026-04-09T02:00:00Z' },
  ],
};

// ── Bridge Sessions ──

export const MOCK_BRIDGE_PROMPTS: BridgePrompt[] = [
  { id: 'p1', text: 'What does your community value most?', order: 1 },
  { id: 'p2', text: "What's something you wish the other side understood about your perspective?", order: 2 },
  { id: 'p3', text: 'Where do you think we might actually agree?', order: 3 },
];

export const MOCK_BRIDGE_SESSIONS: BridgeSession[] = [
  {
    id: 'bridge-001',
    user_a_id: 'user-001',
    user_b_id: 'user-003',
    topic_id: 'topic-002',
    status: 'active',
    match_score: 0.82,
    prompt_sequence: MOCK_BRIDGE_PROMPTS,
    started_at: '2026-04-12T10:00:00Z',
    completed_at: null,
    created_at: '2026-04-12T09:00:00Z',
    partner: { display_name: 'James Hartwell', avatar_url: null, cluster_id: 3, birth_year: 1968 },
    topic: { title: 'What\'s the biggest barrier to affordable housing?' },
  },
  {
    id: 'bridge-002',
    user_a_id: 'user-005',
    user_b_id: 'user-001',
    topic_id: 'topic-001',
    status: 'pending',
    match_score: 0.74,
    prompt_sequence: MOCK_BRIDGE_PROMPTS,
    started_at: null,
    completed_at: null,
    created_at: '2026-04-13T07:00:00Z',
    partner: { display_name: 'Marcus Thompson', avatar_url: null, cluster_id: 5, birth_year: 1985 },
    topic: { title: 'Should cities invest more in public transit or road infrastructure?' },
  },
];

export const MOCK_BRIDGE_MESSAGES: Record<string, BridgeMessage[]> = {
  'bridge-001': [
    { id: 'msg-001', session_id: 'bridge-001', sender_id: 'user-003', content: 'My community values stability. People want to know they can stay in their homes, that the neighborhood they grew up in will still be there for their kids.', prompt_id: 'p1', created_at: '2026-04-12T11:00:00Z' },
    { id: 'msg-002', session_id: 'bridge-001', sender_id: 'user-001', content: 'That resonates with me. I think my community values opportunity — the ability to build something, start a business, raise a family without drowning in costs. But stability is part of that too.', prompt_id: 'p1', created_at: '2026-04-12T14:30:00Z' },
    { id: 'msg-003', session_id: 'bridge-001', sender_id: 'user-003', content: 'I think what people on my side don\'t always get is that growth isn\'t the enemy of stability. You can build new housing without destroying what\'s already there. The question is how.', prompt_id: 'p2', created_at: '2026-04-13T08:00:00Z' },
  ],
};

// ── Cluster Map Points (fake scatter for visualization) ──

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
