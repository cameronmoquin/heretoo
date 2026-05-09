/**
 * /the-parlor — the editorial collection.
 *
 * Source of Truth, Milestone 11. Twelve essays in the editorial year,
 * each one a written gift rather than an optimized listicle. Lists
 * published essays first, then the forthcoming calendar so readers
 * can see the cadence.
 *
 * Tone of the index page itself: the same calm voice the essays use.
 * No "Subscribe" CTAs, no exit-intent popups, no email capture.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPublishedEssays, getForthcomingEssays } from '../../lib/parlor';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function ParlorIndex() {
  const s = makeStyles();
  const published = getPublishedEssays();
  const forthcoming = getForthcomingEssays();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.masthead}>
          <Text style={s.kicker}>The Parlor</Text>
          <Text style={s.title}>Slow essays, written rather than optimized.</Text>
          <Text style={s.lede}>
            Twelve in the year. Each one a gift to a specific reader. No newsletter
            signup, no popup, no "subscribe to read." If you want to come back, the
            URL is the same as it was.
          </Text>
        </View>

        {published.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Published</Text>
            {published.map((essay) => (
              <TouchableOpacity
                key={essay.slug}
                style={s.row}
                activeOpacity={0.75}
                onPress={() => router.push(`/the-parlor/${essay.slug}` as any)}
              >
                <Text style={s.rowDate}>{formatDate(essay.publishedAt)}</Text>
                <Text style={s.rowTitle}>{essay.title}</Text>
                <Text style={s.rowDesc}>{essay.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {forthcoming.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Forthcoming</Text>
            {forthcoming.map((essay) => (
              <View key={essay.slug} style={[s.row, s.rowForthcoming]}>
                <Text style={s.rowDate}>{formatDate(essay.publishedAt)}</Text>
                <Text style={s.rowTitle}>{essay.title}</Text>
                <Text style={s.rowDesc}>{essay.description}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <TouchableOpacity onPress={() => router.push('/' as any)} style={s.footerLink}>
            <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
            <Text style={s.footerLinkText}>Start a family on HereToo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.xl },

  masthead: { gap: 10 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  lede: {
    fontSize: 17, lineHeight: 28, color: Colors.textSecondary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },

  section: { gap: 6 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
    marginBottom: 6,
  },

  row: {
    paddingHorizontal: 0, paddingVertical: 14,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  rowForthcoming: { opacity: 0.55 },
  rowDate: {
    fontSize: 11, fontWeight: '600', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  rowTitle: {
    fontSize: 19, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  rowDesc: {
    fontSize: 14, lineHeight: 21, color: Colors.textSecondary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any)
      : {}),
  },

  footer: { paddingTop: Spacing.lg },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary, letterSpacing: 0.1 },
}); }
