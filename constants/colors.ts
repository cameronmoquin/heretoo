export const Colors = {
  // Brand — HereToo temporary brand spec
  brandIvory: '#F0EEE8',     // "HERE" color
  brandGold: '#E8C97A',      // "Too" color
  brandDark: '#0C0C0F',      // Background / app icon

  // Primary palette (app UI)
  primary: '#E8C97A',          // Gold — primary action color
  primaryDark: '#D4B568',
  primaryLight: '#F0D998',

  // Neutrals
  background: '#0C0C0F',
  surface: '#1A1A1F',
  surfaceLight: '#2A2A30',
  border: '#3A3A42',
  textPrimary: '#F0EEE8',
  textSecondary: '#A0A0A8',
  textMuted: '#6B6B75',

  // Engagement colors
  agree: '#10B981',
  disagree: '#EF4444',
  important: '#F59E0B',
  bridge: '#3B82F6',
  share: '#8B5CF6',

  // Bridge score badge colors
  badgeLocal: '#6B6B75',
  badgeReaching: '#3B82F6',
  badgeBridging: '#10B981',
  badgeCommonGround: '#E8C97A',

  // Cluster colors (for ClusterMap visualization)
  clusters: {
    pragmatic_center: '#6B7280',
    community_focused: '#3B82F6',
    tradition_minded: '#92400E',
    reform_oriented: '#10B981',
    liberty_focused: '#F59E0B',
    unclassified: '#D1D5DB',
  },

  // System
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
} as const;
