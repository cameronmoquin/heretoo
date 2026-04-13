import { StyleSheet, Platform } from 'react-native';
import { Colors } from './colors';

/**
 * System font stack. The most invisible choice.
 * iOS: SF Pro. Android: Roboto. Web: system default.
 * Nobody notices it. That is the point.
 */

const SYSTEM = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: 'System',
});

export const Fonts = {
  logo: SYSTEM,
  heading: SYSTEM,
  body: SYSTEM,
  bodyMedium: SYSTEM,
  bodySemiBold: SYSTEM,
} as const;

/**
 * Font weights — used inline since system fonts use fontWeight not fontFamily.
 */
export const Weight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/**
 * Tight, social-app-sized type scale.
 * Instagram body = 14px. Twitter = 15px. We split the difference.
 */
export const Typography = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: Weight.bold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  h2: {
    fontSize: 18,
    fontWeight: Weight.bold,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  h3: {
    fontSize: 16,
    fontWeight: Weight.semibold,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  body: {
    fontSize: 14,
    fontWeight: Weight.regular,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: Weight.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: Weight.regular,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: Weight.semibold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  button: {
    fontSize: 15,
    fontWeight: Weight.semibold,
    lineHeight: 20,
  },
});
