/**
 * The HereToo brand, two parts:
 *
 *   HereTooMark — the glyph. Twin uprights, a crossbar, one raised
 *   stem with a knob at its top. Drawn as a family tree in an earlier
 *   era; read now as what it also always was — a throttle lever
 *   pushed forward. Both readings are true and neither is printed
 *   anywhere. Views only, no SVG dependency, ink follows the theme.
 *
 *   HereTooLogo — the wordmark. HERETOO, ink, letterspaced, the same
 *   word the emails wear.
 *
 * `size` on both is the rough width occupied, so call sites lay out
 * the same regardless of which part they mount.
 */

import React from 'react';
import { Text, View, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/design';

interface LogoProps {
  /** Rough width in pixels. */
  size?: number;
  /** Ink. Defaults to Colors.textPrimary. */
  color?: string;
}

export function HereTooMark({ size = 48, color }: LogoProps) {
  const c = color ?? Colors.textPrimary;

  // Internal coordinate system: 100 wide × 120 tall.
  const W = 100;
  const H = 120;
  const k = size / W;
  const px = (n: number) => n * k;

  const trunkW = 14;
  const stemW = 12;
  const barH = 12;

  const stemTop = 6;
  const barY = 56;
  const trunkTop = 30;
  const trunkBottom = H - 6;
  const apexR = 7;

  return (
    <View
      style={{ width: px(W), height: px(H), position: 'relative' }}
      accessibilityLabel="HereToo"
    >
      <View style={{
        position: 'absolute',
        left: px(50 - apexR), top: px(stemTop - apexR),
        width: px(apexR * 2), height: px(apexR * 2),
        borderRadius: px(apexR), backgroundColor: c,
      }} />
      <View style={{
        position: 'absolute',
        left: px(50 - stemW / 2), top: px(stemTop),
        width: px(stemW), height: px(barY + barH - stemTop),
        backgroundColor: c,
        borderTopLeftRadius: px(stemW / 2), borderTopRightRadius: px(stemW / 2),
      }} />
      <View style={{
        position: 'absolute',
        left: px(12), top: px(barY),
        width: px(W - 24), height: px(barH),
        backgroundColor: c, borderRadius: px(2),
      }} />
      <View style={{
        position: 'absolute',
        left: px(14), top: px(trunkTop),
        width: px(trunkW), height: px(trunkBottom - trunkTop),
        backgroundColor: c,
        borderTopLeftRadius: px(trunkW / 2), borderTopRightRadius: px(trunkW / 2),
      }} />
      <View style={{
        position: 'absolute',
        left: px(8), top: px(trunkBottom - 4),
        width: px(trunkW + 12), height: px(6),
        backgroundColor: c, borderRadius: px(3),
      }} />
      <View style={{
        position: 'absolute',
        left: px(W - 14 - trunkW), top: px(trunkTop),
        width: px(trunkW), height: px(trunkBottom - trunkTop),
        backgroundColor: c,
        borderTopLeftRadius: px(trunkW / 2), borderTopRightRadius: px(trunkW / 2),
      }} />
      <View style={{
        position: 'absolute',
        left: px(W - 14 - trunkW - 6), top: px(trunkBottom - 4),
        width: px(trunkW + 12), height: px(6),
        backgroundColor: c, borderRadius: px(3),
      }} />
    </View>
  );
}

export function HereTooLogo({ size = 48, color }: LogoProps) {
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
