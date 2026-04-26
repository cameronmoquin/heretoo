import React, { useMemo } from 'react';
import { Image, View, StyleSheet, type ImageStyle, type ViewStyle } from 'react-native';
import { familyCrestUri } from '../../lib/family-crest';

export interface FamilyCrestProps {
  /** Stable seed — typically the family group id. */
  seed: string;
  /** Family name; affects monogram initials when the field is plain. */
  name?: string;
  /** Render size (square box; the shield aspect ratio is preserved). */
  size?: number;
  /** Optional outer style override. */
  style?: ViewStyle;
}

/**
 * Deterministic, generated SVG family crest.
 *
 * The same `seed` always renders the same crest, so a family is recognizable
 * across the app without storing the SVG. No new dependencies — the SVG is
 * URL-encoded into a data URI and rendered through `<Image />` (works on web
 * and native via react-native-web's Image).
 */
export function FamilyCrest({ seed, name, size = 44, style }: FamilyCrestProps) {
  const uri = useMemo(() => familyCrestUri(seed, name), [seed, name]);
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
