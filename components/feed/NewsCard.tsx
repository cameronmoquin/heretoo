/**
 * NewsCard — a wire story sitting inline in the post feed.
 *
 * Same row treatment as a person's drop: full column width, 16 of
 * padding, one hairline along the bottom. No fill, no rail, no kicker.
 * What separates it from a person is a small muted source label above
 * the headline, and the absence of an avatar and an action row.
 *
 * Tapping leaves HereToo. The publisher hosts the article; this row
 * carries the headline and the credit and nothing else.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NewsItem } from '../../hooks/useNews';
import { Colors } from '../../constants/colors';
import { Layout, Spacing, Radius, Type } from '../../constants/design';

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const s = makeStyles();
  const [imageDead, setImageDead] = useState(false);
  const showImage = !!item.image_url && !imageDead;

  const open = () => {
    if (!item.url) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(item.url);
    }
  };

  return (
    <Pressable
      style={s.row}
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`${item.source_label}: ${item.headline}`}
    >
      <View style={s.metaRow}>
        <Text style={s.source} numberOfLines={1}>{item.source_label}</Text>
        <Text style={s.dot}>·</Text>
        <Text style={s.time}>{relTime(item.published_at)}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name="open-outline"
          size={14}
          color={Colors.textMuted}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      </View>

      <Text style={s.headline}>{item.headline}</Text>

      {showImage && (
        <View style={s.imageWrap}>
          <Image
            source={{ uri: item.image_url as string }}
            style={s.image}
            resizeMode="cover"
            onError={() => setImageDead(true)}
            accessibilityIgnoresInvertColors
          />
        </View>
      )}
    </Pressable>
  );
}

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
  // The source, quietly. This is the only thing marking the row as wire.
  source: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, flexShrink: 1,
  },
  dot: { fontSize: Type.caption.size, color: Colors.textMuted },
  time: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  headline: {
    fontSize: Type.cardTitle.size,
    lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight,
    color: Colors.textPrimary,
  },
  imageWrap: {
    width: '100%', aspectRatio: 16 / 9,
    borderRadius: Radius.media,
    backgroundColor: Colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: Spacing.xxs,
  },
  image: { width: '100%', height: '100%' },
}); }
