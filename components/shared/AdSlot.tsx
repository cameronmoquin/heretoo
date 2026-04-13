import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Shadow, Radius, Spacing } from '../../constants/design';
import type { MockAd } from '../../lib/mock-ads';

interface AdSlotProps {
  ad: MockAd;
  isAdFree?: boolean;
  backgroundColors?: readonly [string, string];
}

export function AdSlot({ ad, isAdFree = false, backgroundColors }: AdSlotProps) {
  if (isAdFree && backgroundColors) {
    return (
      <View
        style={[
          styles.adFreeSlot,
          { backgroundColor: backgroundColors[0] },
        ]}
      />
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => Linking.openURL(ad.ctaUrl)}
    >
      {/* Ad label */}
      <View style={styles.topRow}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Ad</Text>
        </View>
        <Text style={styles.advertiserName}>{ad.advertiser}</Text>
        {ad.badgeText && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{ad.badgeText}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <Text style={styles.headline}>{ad.headline}</Text>
      <Text style={styles.body}>{ad.body}</Text>

      {/* CTA */}
      <View style={styles.ctaRow}>
        <View style={styles.ctaButton}>
          <Text style={styles.ctaText}>{ad.ctaLabel}</Text>
        </View>
        <Text style={styles.ctaUrl}>
          {ad.ctaUrl.replace('https://', '')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm + 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  adFreeSlot: {
    height: 8,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 4,
    opacity: 0.3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  adBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  advertiserName: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: Colors.primaryFaint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
  },
  headline: {
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.sm + 4,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  ctaButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  ctaText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: '#FFFFFF',
  },
  ctaUrl: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
});
