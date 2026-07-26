import { Platform } from 'react-native';

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

// The old `Typography` StyleSheet lived here with a second, contradicting
// type scale (its `body` was 14 against design.ts `Type.body` 16). Nothing
// consumed it. The canonical scale is `Type` in constants/design.ts.
