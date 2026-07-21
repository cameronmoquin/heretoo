/**
 * DropCard: one public deaddrop sitting inline in the feed.
 *
 * Carries the title, the hint, and the pickup count. That is the whole
 * card. Coordinates stay off it, and so does the photo. A drop is
 * sealed until the seeker physically stands on it; putting the picture
 * in a scrollable column would hand it to everyone who never left the
 * couch and kill the feature.
 *
 * Tapping opens the run at /hunt/{share_code}.
 *
 * Same structural device as NewsCard and LoftCard: recessed canvas,
 * hairline top rule, colored edge. Blue edge here, so the three
 * non-crew rails stay distinguishable at a glance.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { HuntCache } from '../../hooks/useHunt';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';

interface DropCardProps {
  cache: HuntCache;
}

export function DropCard({ cache }: DropCardProps) {
  const s = makeStyles();
  const title = cache.title?.trim() || 'Unmarked drop';
  const hint = cache.hint?.trim();
  const found = cache.found_count ?? 0;
  const pickups = `${found} ${found === 1 ? 'pickup' : 'pickups'}`;

  const open = () => {
    if (!cache.share_code) return;
    router.push(`/hunt/${cache.share_code}` as any);
  };

  return (
    <Pressable
      style={s.card}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Deaddrop: ${title}. ${pickups}.`}
    >
      <View style={s.rule} pointerEvents="none" />

      <View style={s.body}>
        <View style={s.metaRow}>
          <Text style={s.kicker}>DROP</Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.count}>{pickups}</Text>
          <View style={{ flex: 1 }} />
          <Ionicons
            name="navigate-outline"
            size={12}
            color={Colors.textMuted}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
        </View>

        <Text style={s.title}>{title}</Text>

        {!!hint && (
          <Text style={s.hint} numberOfLines={3}>
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingLeft: Spacing.md + 3,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rule: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: Colors.bridge,
    opacity: 0.8,
  },
  body: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: {
    fontSize: Type.eyebrow.size,
    lineHeight: Type.eyebrow.lineHeight,
    fontWeight: '800',
    letterSpacing: Type.eyebrow.letterSpacing,
    color: Colors.bridge,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  dot: { fontSize: 10, color: Colors.textMuted },
  count: {
    fontSize: 10, fontWeight: '600', letterSpacing: 0.6,
    textTransform: 'uppercase', color: Colors.textMuted,
  },
  title: {
    fontSize: 17, lineHeight: 24, fontWeight: '700',
    letterSpacing: -0.2, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  hint: {
    fontSize: 14, lineHeight: 20, fontWeight: '400',
    color: Colors.textSecondary,
  },
}); }
