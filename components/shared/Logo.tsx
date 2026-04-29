/**
 * HereToo wordmark — "HT" stylized as a family tree.
 *
 * Geometry (viewBox-style, scaled by `size`):
 *   - Two outer verticals = the H's posts AND the tree's twin trunks.
 *   - A wide crossbar = the H's crossbar AND the T's top.
 *   - A central vertical above the crossbar = the T's stem AND the tree
 *     growing upward from the union of the two trunks.
 *   - A small dot at the apex = the canopy / new growth.
 *   - Subtle root flares at the bottom of each trunk.
 *
 * Two trunks joining at the crossbar with one shared stem rising from
 * them is the family-tree metaphor: parents → child. It reads as both
 * "HT" and a tree silhouette without leaning on any pre-existing
 * brand vocabulary (no chromatic-aberration glitch, no bird, no leaf
 * cluster — just structure).
 *
 * Drawn entirely in <View> + StyleSheet so we don't pull in
 * react-native-svg, the colors flip with the theme palette through
 * the active `color` prop, and it stays pin-sharp on every platform.
 */

import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../constants/colors';

interface LogoProps {
  /** Width in pixels. Height is computed from the ~1:1.2 aspect ratio. */
  size?: number;
  /** Stroke color. Defaults to Colors.textPrimary. */
  color?: string;
}

export function HereTooLogo({ size = 48, color }: LogoProps) {
  const c = color ?? Colors.textPrimary;

  // Internal coordinate system: 100 wide × 120 tall.
  const W = 100;
  const H = 120;
  const k = size / W;
  const px = (n: number) => n * k;

  const trunkW = 14;
  const stemW = 12;
  const barH = 12;

  // y positions
  const stemTop = 6;             // top of the central stem
  const barY = 56;               // top of crossbar
  const trunkTop = 30;           // top of the two verticals
  const trunkBottom = H - 6;
  const apexR = 7;

  return (
    <View style={{ width: px(W), height: px(H), position: 'relative' }}>
      {/* Apex — small circle, the canopy bud */}
      <View
        style={{
          position: 'absolute',
          left: px(50 - apexR),
          top: px(stemTop - apexR),
          width: px(apexR * 2),
          height: px(apexR * 2),
          borderRadius: px(apexR),
          backgroundColor: c,
        }}
      />

      {/* Central stem — T's vertical, tree growing up from the canopy */}
      <View
        style={{
          position: 'absolute',
          left: px(50 - stemW / 2),
          top: px(stemTop),
          width: px(stemW),
          height: px(barY + barH - stemTop),
          backgroundColor: c,
          borderTopLeftRadius: px(stemW / 2),
          borderTopRightRadius: px(stemW / 2),
        }}
      />

      {/* Crossbar — shared between H and T */}
      <View
        style={{
          position: 'absolute',
          left: px(12),
          top: px(barY),
          width: px(W - 24),
          height: px(barH),
          backgroundColor: c,
          borderRadius: px(2),
        }}
      />

      {/* Left trunk */}
      <View
        style={{
          position: 'absolute',
          left: px(14),
          top: px(trunkTop),
          width: px(trunkW),
          height: px(trunkBottom - trunkTop),
          backgroundColor: c,
          borderTopLeftRadius: px(trunkW / 2),
          borderTopRightRadius: px(trunkW / 2),
        }}
      />
      {/* Left root flare */}
      <View
        style={{
          position: 'absolute',
          left: px(8),
          top: px(trunkBottom - 4),
          width: px(trunkW + 12),
          height: px(6),
          backgroundColor: c,
          borderRadius: px(3),
        }}
      />

      {/* Right trunk */}
      <View
        style={{
          position: 'absolute',
          left: px(W - 14 - trunkW),
          top: px(trunkTop),
          width: px(trunkW),
          height: px(trunkBottom - trunkTop),
          backgroundColor: c,
          borderTopLeftRadius: px(trunkW / 2),
          borderTopRightRadius: px(trunkW / 2),
        }}
      />
      {/* Right root flare */}
      <View
        style={{
          position: 'absolute',
          left: px(W - 14 - trunkW - 6),
          top: px(trunkBottom - 4),
          width: px(trunkW + 12),
          height: px(6),
          backgroundColor: c,
          borderRadius: px(3),
        }}
      />
    </View>
  );
}
