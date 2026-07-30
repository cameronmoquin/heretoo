/**
 * Eyebrow - the uppercase kicker.
 *
 * One canonical tracking for every section marker in the app. Size and
 * letterSpacing come from Type.eyebrow. Color defaults muted. Pass
 * accentColor to color it (the rail kicker sits in the edge color).
 * On web the skin's display font carries through.
 *
 * Replaces the hand-set 0.5 / 1.6 / 2 / 2.4 trackings scattered across
 * the screens.
 */

import React from 'react';
import { Text, StyleSheet, Platform, type TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Type } from '../../constants/design';
import { Gen } from '../../constants/generations';

interface EyebrowProps {
  children: React.ReactNode;
  /** Kicker color. Default Colors.textMuted. Pass Colors.primary or a rail color to accent. */
  accentColor?: string;
  numberOfLines?: number;
  style?: TextStyle;
}

export function Eyebrow({ children, accentColor, numberOfLines, style }: EyebrowProps) {
  const s = makeStyles(accentColor ?? Colors.textMuted);
  return (
    <Text style={[s.eyebrow, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

function makeStyles(color: string) { return StyleSheet.create({
  eyebrow: {
    fontSize: Type.eyebrow.size,
    lineHeight: Type.eyebrow.lineHeight,
    // The rail kickers render at 800. Match them.
    fontWeight: '800',
    letterSpacing: Type.eyebrow.letterSpacing,
    textTransform: 'uppercase',
    color,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
}); }
