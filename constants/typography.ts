import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Fonts = {
  logo: 'Syne_800ExtraBold',
  heading: 'Inter_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const Typography = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontFamily: Fonts.heading,
    color: Colors.textPrimary,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  button: {
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    lineHeight: 24,
  },
});
