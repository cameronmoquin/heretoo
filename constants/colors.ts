/**
 * Retro digital glitch palette.
 * Dark base. Neon accents. CRT energy.
 * Clean enough to use. Weird enough to remember.
 */

export const Colors = {
  // Brand
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0A0A0F',

  // Primary — electric blue with a hint of purple
  primary: '#4F6EFF',
  primaryDark: '#3B5AE8',
  primaryLight: '#7B93FF',
  primaryFaint: 'rgba(79, 110, 255, 0.08)',

  // Background — near-black with blue undertone
  background: '#0A0A0F',
  surface: '#12121A',
  surfaceLight: '#1A1A25',
  border: '#252535',
  borderLight: '#1E1E2A',
  textPrimary: '#E8E8F0',
  textSecondary: '#8888A0',
  textMuted: '#555568',

  // Neon accents
  agree: '#00FF88',
  disagree: '#FF0040',
  important: '#FFB800',
  bridge: '#00D4FF',
  share: '#BF5AF2',

  // Badges
  badgeLocal: '#555568',
  badgeReaching: '#00D4FF',
  badgeBridging: '#00FF88',
  badgeCommonGround: '#FFB800',

  // Clusters
  clusters: {
    pragmatic_center: '#8888A0',
    community_focused: '#4F6EFF',
    tradition_minded: '#C4622D',
    reform_oriented: '#00FF88',
    liberty_focused: '#FFB800',
    unclassified: '#555568',
  },

  // System
  error: '#FF0040',
  warning: '#FFB800',
  success: '#00FF88',
  info: '#00D4FF',
} as const;
