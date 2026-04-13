export const Colors = {
  // Brand — HereToo logo only
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0C0C0F',

  // Primary palette — warm emerald (growth, bridging, common ground)
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#34D399',
  primaryFaint: 'rgba(5, 150, 105, 0.08)',

  // Neutrals — warm light base
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceLight: '#F3F3F0',
  border: '#E5E3DE',
  borderLight: '#EEEDEA',
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textMuted: '#9C9C9C',

  // Engagement colors
  agree: '#059669',
  disagree: '#DC2626',
  important: '#D97706',
  bridge: '#2563EB',
  share: '#7C3AED',

  // Bridge score badge colors
  badgeLocal: '#9C9C9C',
  badgeReaching: '#2563EB',
  badgeBridging: '#059669',
  badgeCommonGround: '#D97706',

  // Cluster colors (for ClusterMap visualization)
  clusters: {
    pragmatic_center: '#6B7280',
    community_focused: '#2563EB',
    tradition_minded: '#92400E',
    reform_oriented: '#059669',
    liberty_focused: '#D97706',
    unclassified: '#D1D5DB',
  },

  // System
  error: '#DC2626',
  warning: '#D97706',
  success: '#059669',
  info: '#2563EB',
} as const;
