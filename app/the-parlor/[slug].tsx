/**
 * /the-parlor/[slug] — single essay reader.
 *
 * Source of Truth, Milestone 11. Source Serif 4 at 19px / 1.7 line
 * height in a 720px column. Read-aloud button at the top reads the
 * full essay in Bike Messenger. Each essay ends with a single muted
 * "Start a family on HereToo" link.
 *
 * No popup, no email capture, no exit-intent modal, no A/B test.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getEssay, getPublishedEssays } from '../../lib/parlor';
import { useTTS } from '../../stores/ttsStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function EssayScreen() {
  const s = makeStyles();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const essay = slug ? getEssay(slug) : undefined;
  const tts = useTTS();

  if (!essay || !essay.published || !essay.body) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.notFound}>
          <Text style={s.notFoundTitle}>That essay isn't out yet.</Text>
          <Text style={s.notFoundBody}>
            The Parlor publishes one essay a month. The full year is on the index.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/the-parlor' as any)} style={s.cta}>
            <Text style={s.ctaText}>The Parlor</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fullText = essay.body.join(' ');
  const ttsActive = tts.currentId === `essay-${essay.slug}` && tts.playing;
  const onReadAloud = () => tts.toggle(`essay-${essay.slug}`, fullText);

  // Article schema as JSON-LD for SEO. Web only — native renders nothing.
  const schema = React.useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: essay.title,
    description: essay.description,
    datePublished: essay.publishedAt,
    dateModified: essay.updatedAt ?? essay.publishedAt,
    author: { '@type': 'Organization', name: 'HereToo' },
    publisher: {
      '@type': 'Organization',
      name: 'HereToo',
      logo: { '@type': 'ImageObject', url: 'https://heretoo.social/favicon-512.png' },
    },
    mainEntityOfPage: `https://heretoo.social/the-parlor/${essay.slug}`,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['article'],
    },
  }), [essay]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen
        options={{
          title: essay.title,
          // The web renderer reads `title` and sets <title>. Description
          // and OG tags are added via the static index.html injection
          // pipeline; per-essay is a follow-up.
        }}
      />
      {Platform.OS === 'web' && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement('script' as any, {
          type: 'application/ld+json',
          dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
        })
      )}

      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace('/the-parlor' as any)}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          <Text style={s.backText}>The Parlor</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onReadAloud} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={ttsActive ? 'pause' : 'volume-medium-outline'}
            size={18}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.plaque}>
          <Text style={s.kicker}>Essay · {formatDate(essay.publishedAt)}</Text>
          <Text style={s.title}>{essay.title}</Text>
          <Text style={s.dek}>{essay.description}</Text>
        </View>

        <View>
          {essay.body.map((para, i) => (
            <Text key={i} style={s.paragraph}>{para}</Text>
          ))}
        </View>

        {/* Internal links — the parlor builds a graph */}
        {essay.related && essay.related.length > 0 && (
          <View style={s.relatedBlock}>
            <Text style={s.relatedKicker}>Read next</Text>
            {essay.related.map((slug) => {
              const related = getPublishedEssays().find((e) => e.slug === slug);
              if (!related) return null;
              return (
                <TouchableOpacity
                  key={slug}
                  style={s.relatedRow}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/the-parlor/${slug}` as any)}
                >
                  <Text style={s.relatedTitle}>{related.title}</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={s.outro}>
          <TouchableOpacity onPress={() => router.replace('/(auth)/welcome' as any)} style={s.outroLink}>
            <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
            <Text style={s.outroLinkText}>Start a family on HereToo</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 4,
  },
  backText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  iconBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 80, gap: Spacing.xl },

  plaque: { paddingTop: Spacing.md, gap: 8 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  dek: {
    fontSize: 18, lineHeight: 28, color: Colors.textSecondary, fontStyle: 'italic',
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any)
      : {}),
  },

  paragraph: {
    fontSize: 19, lineHeight: 32, color: Colors.textPrimary,
    marginBottom: 18,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },

  relatedBlock: { gap: 6, paddingTop: Spacing.md },
  relatedKicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
    marginBottom: 6,
  },
  relatedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  relatedTitle: {
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1, paddingRight: 12,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  outro: { paddingTop: Spacing.md },
  outroLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  outroLinkText: { fontSize: 13, fontWeight: '600', color: Colors.primary, letterSpacing: 0.1 },

  notFound: { padding: Spacing.xl, gap: Spacing.md },
  notFoundTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  notFoundBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  ctaText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
}); }
