/**
 * Eyebrow — RETIRED AS A LOOK, kept as a shim.
 *
 * docs/UI_SYSTEM.md §5 retires the uppercase kicker: no eyebrows, no
 * section markers, muted caption or nothing. PostCard already did this
 * by hand in phase 2, replacing <Eyebrow> with a plain muted caption.
 *
 * Deleting the component instead would have meant rewriting every JSX
 * call site across 32 files and inventing a local style in each — a lot
 * of visually-consequential surgery for a change that is, in the end,
 * one text style. So the style moved here. Every caller conforms at
 * once, and removing the component later is a pure refactor with no
 * visual consequence, file by file, whenever anyone is in there.
 *
 * accentColor is now ignored on purpose. The system has one accent, the
 * heart, and it is not for section markers.
 */

import React from 'react';
import { Text, StyleSheet, Platform, type TextStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Type, FontFamily } from '../../constants/design';

interface EyebrowProps {
  children: React.ReactNode;
  /** Kicker color. Default Colors.textMuted. Pass Colors.primary or a rail color to accent. */
  accentColor?: string;
  numberOfLines?: number;
  style?: TextStyle;
}

export function Eyebrow({ children, numberOfLines, style }: EyebrowProps) {
  const s = makeStyles();
  return (
    <Text style={[s.eyebrow, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

function makeStyles() { return StyleSheet.create({
  eyebrow: {
    // Caption, muted, sentence case. Was 800-weight uppercase on
    // Type.eyebrow tracking, in an accent colour.
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '400',
    color: Colors.textMuted,
    ...(Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {}),
  },
}); }
