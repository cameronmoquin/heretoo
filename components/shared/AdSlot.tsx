import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Spacing } from '../../constants/design';
import type { MockAd } from '../../lib/mock-ads';

interface AdSlotProps {
  ad: MockAd;
  isAdFree?: boolean;
  backgroundColors?: readonly [string, string];
}

export function AdSlot({ ad, isAdFree = false, backgroundColors }: AdSlotProps) {
  if (isAdFree && backgroundColors) {
    return <View style={[styles.adFree, { backgroundColor: backgroundColors[0] }]} />;
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(ad.ctaUrl)}
    >
      <View style={styles.topRow}>
        <Text style={styles.adLabel}>Sponsored</Text>
        {ad.badgeText && <Text style={styles.badge}>{ad.badgeText}</Text>}
      </View>
      <Text style={styles.headline}>{ad.headline}</Text>
      <Text style={styles.body}>{ad.body}</Text>
      <View style={styles.ctaRow}>
        <Text style={styles.cta}>{ad.ctaLabel}</Text>
        <Text style={styles.url}>{ad.ctaUrl.replace('https://', '')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  adFree: { height: 6, marginHorizontal: Spacing.md, borderRadius: 3, opacity: 0.2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  adLabel: { fontSize: 11, fontFamily: Fonts.bodyMedium, color: Colors.textMuted, letterSpacing: 0.3 },
  badge: { fontSize: 10, fontFamily: Fonts.bodySemiBold, color: Colors.primary, backgroundColor: Colors.primaryFaint, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  headline: { fontSize: 16, fontFamily: Fonts.bodySemiBold, color: Colors.textPrimary, marginBottom: 3 },
  body: { fontSize: 14, fontFamily: Fonts.body, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cta: { fontSize: 14, fontFamily: Fonts.bodySemiBold, color: Colors.primary },
  url: { fontSize: 12, fontFamily: Fonts.body, color: Colors.textMuted },
});
