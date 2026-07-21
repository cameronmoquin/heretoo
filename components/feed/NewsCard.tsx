/**
 * NewsCard — a wire story sitting inline in the post feed.
 *
 * Deliberately shaped unlike PostCard. No avatar, no heart, no comment
 * rail, recessed canvas instead of a lifted surface, and a gold rule
 * down the left edge. A person's post lifts off the page. A wire story
 * sinks into it.
 *
 * Tapping leaves HereToo. The publisher hosts the article; this card
 * carries the headline and the credit and nothing else.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NewsItem } from '../../hooks/useNews';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';

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
      style={s.card}
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel={`${item.source_label}: ${item.headline}`}
    >
      <View style={s.rule} pointerEvents="none" />

      <View style={s.body}>
        <View style={s.metaRow}>
          <Text style={s.source} numberOfLines={1}>
            {item.source_label.toUpperCase()}
          </Text>
          <Text style={s.dot}>·</Text>
          <Text style={s.time}>{relTime(item.published_at)}</Text>
          <View style={{ flex: 1 }} />
          <Ionicons
            name="open-outline"
            size={12}
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
      </View>
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
  // Recessed against PostCard's Colors.surface, and the only card in
  // the stream with a colored edge.
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
    backgroundColor: Colors.primary,
    opacity: 0.6,
  },
  body: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  source: {
    fontSize: Type.eyebrow.size,
    lineHeight: Type.eyebrow.lineHeight,
    fontWeight: '800',
    letterSpacing: Type.eyebrow.letterSpacing,
    color: Colors.primary,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  dot: { fontSize: 10, color: Colors.textMuted },
  time: {
    fontSize: 10, fontWeight: '600', letterSpacing: 0.6,
    textTransform: 'uppercase', color: Colors.textMuted,
  },
  headline: {
    fontSize: 17, lineHeight: 24, fontWeight: '700',
    letterSpacing: -0.2, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  imageWrap: {
    width: '100%', aspectRatio: 16 / 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
    marginTop: 2,
  },
  image: { width: '100%', height: '100%' },
}); }
