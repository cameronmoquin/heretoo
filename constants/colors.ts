/**
 * Bell curve center palette.
 * Blue is the most universally liked color across every demographic.
 * Warm white background. Soft shadows. Nothing that draws attention to itself.
 * The UI disappears. The content stays.
 */

export const Colors = {
  // Brand
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0C0C0F',

  // Primary — confident calm blue. The color every demo agrees on.
  primary: '#3478F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  primaryFaint: 'rgba(52, 120, 246, 0.06)',

  // Neutrals — warm white, never harsh
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceLight: '#F5F5F7',
  border: '#E8E8ED',
  borderLight: '#F0F0F5',
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textMuted: '#AEAEB2',

  // Engagement — muted, not screaming
  agree: '#34C759',
  disagree: '#FF3B30',
  important: '#FF9500',
  bridge: '#5856D6',
  share: '#AF52DE',

  // Bridge badges
  badgeLocal: '#AEAEB2',
  badgeReaching: '#5856D6',
  badgeBridging: '#34C759',
  badgeCommonGround: '#FF9500',

  // Clusters
  clusters: {
    pragmatic_center: '#8E8E93',
    community_focused: '#3478F6',
    tradition_minded: '#A2845E',
    reform_oriented: '#34C759',
    liberty_focused: '#FF9500',
    unclassified: '#D1D1D6',
  },

  // System
  error: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',
  info: '#3478F6',
} as const;
