/**
 * DropCard: one public deaddrop sitting inline in the feed.
 *
 * Carries the title, the hint, and the pickup count. That is the whole
 * row. Coordinates stay off it, and so does the photo. A drop is sealed
 * until the seeker physically stands on it; putting the picture in a
 * scrollable column would hand it to everyone who never left the couch
 * and kill the feature. The seal is the feature.
 *
 * Tapping opens the run at /hunt/{share_code}.
 *
 * Same row treatment as a person's drop: full column width, 16 of
 * padding, one hairline along the bottom. No fill, no blue rail, no
 * kicker. A small muted kind label carries the difference.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { HuntCache } from '../../hooks/useHunt';
import { Colors } from '../../constants/colors';
import { Layout, Spacing, Type } from '../../constants/design';

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
      style={s.row}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Deaddrop: ${title}. ${pickups}.`}
    >
      <View style={s.metaRow}>
        <Text style={s.kind}>Deaddrop</Text>
        <Text style={s.dot}>·</Text>
        <Text style={s.count}>{pickups}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name="navigate-outline"
          size={14}
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
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  row: {
    paddingHorizontal: Layout.rowPaddingHorizontal,
    paddingVertical: Layout.rowPaddingVertical,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xxs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  dot: { fontSize: Type.caption.size, color: Colors.textMuted },
  count: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  title: {
    fontSize: Type.cardTitle.size,
    lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight,
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textSecondary,
  },
}); }
