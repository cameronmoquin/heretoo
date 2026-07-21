/**
 * /news — public broadcasting headlines.
 *
 * Pulls from NPR, BBC World, and PBS NewsHour via RSS. Every item
 * is a click-through to the publisher's site — HereToo doesn't host
 * the article. The platform is the calm reading list, not the
 * substitute for the newsroom.
 *
 * Tabs: All / Global / National / Arts / Science. No "trending,"
 * no "for you," no algorithmic ranking. Sorted by publication time.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNewsFeed, type NewsItem } from '../../hooks/useNews';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

type Cat = 'all' | 'global' | 'national' | 'arts' | 'science';

const CAT_LABELS: Record<Cat, string> = {
  all: 'All',
  global: 'World',
  national: 'National',
  arts: 'Arts',
  science: 'Science',
};

export default function NewsScreen() {
  const s = makeStyles();
  const [cat, setCat] = useState<Cat>('all');
  const { data: items, isLoading } = useNewsFeed(cat);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.masthead}>
          <Text style={s.kicker}>From public broadcasting</Text>
          <Text style={s.title}>The day, plainly.</Text>
          <View style={s.flourishRow}>
            <View style={s.flourishRule} />
            <Text style={s.flourishGlyph}>✦</Text>
            <View style={s.flourishRule} />
          </View>
        </View>

        <View style={s.tabRow}>
          {(Object.keys(CAT_LABELS) as Cat[]).map((c) => {
            const on = cat === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCat(c)}
                style={[s.tabBtn, on && s.tabBtnOn]}
                activeOpacity={0.85}
              >
                <Text style={[s.tabBtnText, on && s.tabBtnTextOn]}>
                  {CAT_LABELS[c]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading && (
          <Text style={s.loading}>Reading…</Text>
        )}

        {!isLoading && (items ?? []).length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Nothing fetched yet.</Text>
          </View>
        )}

        {(items ?? []).map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}

        <Text style={s.footnote}>
          Headlines and summaries appear here under standard fair-use practice
          for news aggregators. The full reporting lives on the publisher&apos;s
          site. Support public broadcasting directly when you can.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const s = makeStyles();
  const open = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(item.url);
    }
  };
  const ago = relTime(item.published_at);

  return (
    <TouchableOpacity onPress={open} style={s.card} activeOpacity={0.85}>
      <View style={s.cardFrame} pointerEvents="none" />
      {item.image_url && (
        <View style={s.imageWrap}>
          <Image source={{ uri: item.image_url }} style={s.image} resizeMode="cover" />
        </View>
      )}
      <View style={s.cardBody}>
        <View style={s.cardMetaRow}>
          <Text style={s.cardSource}>{item.source_label.toUpperCase()}</Text>
          <Text style={s.cardDot}>·</Text>
          <Text style={s.cardTime}>{ago}</Text>
        </View>
        <Text style={s.cardHeadline}>{item.headline}</Text>
        {!!item.summary && (
          <Text style={s.cardSummary} numberOfLines={3}>{item.summary}</Text>
        )}
        <View style={s.readRow}>
          <Text style={s.readText}>Read on {item.source_label}</Text>
          <Ionicons name="open-outline" size={12} color={Colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(diff / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center' },

  masthead: { gap: 14 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  title: {
    fontSize: 50, lineHeight: 56, fontWeight: '800', letterSpacing: -1.2,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  flourishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  flourishRule: { width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55 },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  tabRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnOn: { borderColor: Colors.primary, backgroundColor: 'rgba(201,161,75,0.12)' },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },
  tabBtnTextOn: { color: Colors.primary },

  loading: { textAlign: 'center', color: Colors.textMuted, fontStyle: 'italic', padding: Spacing.lg },

  emptyWrap: { padding: Spacing.lg, gap: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.brandIvory },

  card: {
    position: 'relative',
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderWidth: 1, borderColor: Colors.primary,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  cardFrame: {
    position: 'absolute', top: 8, left: 8, right: 8, bottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.primary, opacity: 0.3,
    borderRadius: Radius.md, pointerEvents: 'none',
  },
  imageWrap: {
    width: '100%', aspectRatio: 16 / 9,
    backgroundColor: Colors.surfaceLight,
  },
  image: { width: '100%', height: '100%' },
  cardBody: { padding: Spacing.md, gap: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSource: {
    fontSize: 10, fontWeight: '800', color: Colors.primary, letterSpacing: 1.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  cardDot: { color: Colors.textMuted, fontSize: 10 },
  cardTime: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
  cardHeadline: {
    fontSize: 19, lineHeight: 26, fontWeight: '700', color: Colors.brandIvory,
    letterSpacing: -0.2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  cardSummary: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  readText: { fontSize: 11, color: Colors.primary, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  footnote: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', lineHeight: 17, paddingTop: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
