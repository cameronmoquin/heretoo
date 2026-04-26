import React, { useMemo } from 'react';
import { Image, View, StyleSheet, type ImageStyle, type ViewStyle } from 'react-native';
import {
  customFamilyCrestUri,
  type CrestDivision,
  type CrestCharge,
} from '../../lib/family-crest';

export interface FamilyCrestProps {
  /** Stable seed — typically the family group id. */
  seed: string;
  /** Family name; affects monogram initials when the field is plain. */
  name?: string;
  /** Render size (the shield aspect ratio is preserved). */
  size?: number;
  /** Optional outer style override. */
  style?: ViewStyle;
  /** Customization overrides — when present, replace the rng-derived defaults. */
  paletteIndex?: number | null;
  division?: CrestDivision | null;
  charge?: CrestCharge | null;
}

/**
 * Deterministic, generated SVG family crest.
 *
 * Same seed → same crest, plus explicit overrides for families that have
 * customized their look. No new dependencies — the SVG is URL-encoded into
 * a data URI and rendered through `<Image />` (web + native).
 */
export function FamilyCrest({
  seed, name, size = 44, style, paletteIndex, division, charge,
}: FamilyCrestProps) {
  const uri = useMemo(
    () => customFamilyCrestUri({ seed, name, paletteIndex, division, charge }),
    [seed, name, paletteIndex, division, charge],
  );
  // Heater shield aspect: 100 × 120 (≈ 5:6). Keep proportional.
  const w = size;
  const h = Math.round(size * 1.2);
  return (
    <View style={[styles.wrap, { width: w, height: h }, style]}>
      <Image source={{ uri }} style={[styles.img, { width: w, height: h } as ImageStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  img: {},
});
