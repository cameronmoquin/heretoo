/**
 * The HereToo wordmark. Text, ink, letterspaced. Nothing else.
 *
 * The previous mark was an "HT" drawn as a family tree — twin trunks,
 * a shared stem, a canopy dot. That was the family-first product's
 * brand and it retired with it. The current brand is the word itself
 * in the app's own face and ink, the same wordmark the emails wear.
 *
 * API unchanged: `size` is the rough width the old glyph occupied, so
 * every call site keeps its layout; `color` still overrides the ink.
 */

import React from 'react';
import { Text } from 'react-native';
import { Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/design';

interface LogoProps {
  /** Rough width in pixels, kept from the glyph era. */
  size?: number;
  /** Ink. Defaults to Colors.textPrimary. */
  color?: string;
}

export function HereTooLogo({ size = 48, color }: LogoProps) {
  // The word is 7 characters plus tracking; this ratio lands the text
  // at about the width the old glyph held at the same `size`.
  const fontSize = Math.max(12, Math.round(size * 0.42));
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="HereToo"
      style={{
        ...(Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {}),
        fontSize,
        lineHeight: Math.round(fontSize * 1.2),
        fontWeight: '800',
        letterSpacing: fontSize * 0.22,
        color: color ?? Colors.textPrimary,
      }}
    >
      HERETOO
    </Text>
  );
}
