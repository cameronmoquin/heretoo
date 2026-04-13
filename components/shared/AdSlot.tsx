import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';

interface AdSlotProps {
  isAdFree?: boolean;
  backgroundColors?: readonly [string, string];
}

/**
 * Ad slot that appears in the feed.
 * If user is ad-free, shows their chosen background instead.
 * If user has ad preferences, shows a relevant ad placeholder.
 */
export function AdSlot({ isAdFree = false, backgroundColors }: AdSlotProps) {
  if (isAdFree && backgroundColors) {
    return (
      <View
        style={[
          styles.container,
          styles.adFreeSlot,
          { backgroundColor: backgroundColors[0] },
        ]}
      />
    );
  }

  // Ad placeholder — in production this would load a real ad
  return (
    <View style={styles.container}>
      <View style={styles.adContent}>
        <Text style={styles.adLabel}>Ad</Text>
        <Text style={styles.adPlaceholder}>Personalized to your interests</Text>
        <TouchableOpacity style={styles.adPrefsLink}>
          <Text style={styles.adPrefsText}>Update ad preferences</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 80,
  },
  adFreeSlot: {
    height: 8,
    minHeight: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  adContent: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 6,
  },
  adLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  adPlaceholder: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
  },
  adPrefsLink: {
    marginTop: 4,
  },
  adPrefsText: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primary,
  },
});
