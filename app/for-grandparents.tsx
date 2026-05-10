/**
 * /for-grandparents — SEO landing page targeting elder citizens.
 *
 * Helper-intent search queries this page is built to rank for:
 *   - "social media for grandparents"
 *   - "social media for older adults"
 *   - "alternative to facebook for elderly"
 *   - "easy social network for seniors"
 *   - "calm social media for grandmothers"
 *   - "private family social network"
 *
 * The page itself is honest editorial — not keyword-stuffed copy. It
 * names the problem in plain language, describes what HereToo does,
 * and ends with a single soft action (Step inside / Start a family).
 *
 * SEO surface includes JSON-LD WebPage + FAQPage + speakable schema.
 * No popups, no exit-intent modals, no email capture, no countdown
 * timers. Plain prose in Source Serif at large size.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius } from '../constants/design';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do I sign my mother up?',
    a: "Start a family on HereToo, then send her a printed welcome card from the family page. When she scans the QR code, the platform reads her a short greeting and lets her in. No fields, no signup wall.",
  },
  {
    q: 'Does it cost money?',
    a: "Five dollars a month or fifty a year, paid by whoever in the family wants to cover it. One adult covers everyone. The first family is free for trial.",
  },
  {
    q: 'Will my mother be able to use it?',
    a: "Three taps to read what the family shared today. Voice input — she can speak, the platform transcribes. A calm voice reads posts aloud while she does the dishes. Type is large by default. The platform never asks for her birthday.",
  },
  {
    q: 'Can she write a letter to a grandchild not yet born?',
    a: "Yes. The Letter feature lets her queue a long-form letter for delivery on a chosen date up to 80 years out. The letter arrives by email — addressed care-of a parent if the grandchild is still small.",
  },
  {
    q: 'Is there advertising?',
    a: "Not in the family rooms. There is a separate public side of the platform where ads are allowed; it's clearly marked and your mother doesn't have to go there.",
  },
  {
    q: 'What about her privacy?',
    a: "Posts are visible only to the family they were posted to. Direct messages from outside the family graph require explicit acceptance. We don't sell data.",
  },
];

export default function ForGrandparentsScreen() {
  const s = makeStyles();

  // SEO: JSON-LD schema. WebPage + FAQPage + speakable.
  const schema = React.useMemo(() => ({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': 'https://heretoo.social/for-grandparents',
        name: 'HereToo for grandparents — social media that respects how older adults pay attention',
        description:
          'A quiet, ad-free family social platform built for grandparents and the people who love them. No infinite scroll, no follower counts, voice input and read-aloud, daily digest at noon.',
        url: 'https://heretoo.social/for-grandparents',
        inLanguage: 'en',
        isPartOf: { '@id': 'https://heretoo.social/#website' },
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: ['article', 'h1', 'h2'],
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'Organization',
        '@id': 'https://heretoo.social/#org',
        name: 'HereToo',
        url: 'https://heretoo.social',
      },
    ],
  }), []);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'HereToo for grandparents — calm, ad-free family social media',
        }}
      />
      {Platform.OS === 'web' && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement('script' as any, {
          type: 'application/ld+json',
          dangerouslySetInnerHTML: { __html: JSON.stringify(schema) },
        })
      )}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.masthead}>
          <Text style={s.kicker}>For grandparents and the people who love them</Text>
          <Text style={s.title}>A safe place for your family.</Text>
          <Text style={s.lede}>
            Each family is its own private room. Inside, you can post, share photos,
            write a letter to be opened in five years, play trivia, get on a video
            call, or just see what your mother said today.
          </Text>
          <View style={s.flourishRow}>
            <View style={s.flourishRule} />
            <Text style={s.flourishGlyph}>✦</Text>
            <View style={s.flourishRule} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>How to get started</Text>
          <Text style={s.body}>
            Someone in the family — usually a daughter or grandchild — starts the
            family on HereToo and sends a printed welcome card by mail. The card has
            a QR code on the back. The grandparent scans it, hears a short greeting
            and is in.
          </Text>
          <Text style={s.body}>
            Once she&apos;s in, the family page shows what the family posted today.
            She can read, listen (a calm voice will read posts aloud while she does
            the dishes), or write something — by typing or by speaking. A daily
            email summary lands in her inbox at noon.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Frequently asked</Text>
          {FAQ.map((f, i) => (
            <View key={i} style={s.faq}>
              <Text style={s.faqQ}>{f.q}</Text>
              <Text style={s.faqA}>{f.a}</Text>
            </View>
          ))}
        </View>

        <View style={s.cta}>
          <Text style={s.ctaTitle}>Step inside.</Text>
          <Text style={s.ctaBody}>
            The first family is free. The room is decorated. Bring your
            grandmother home.
          </Text>
          <View style={s.ctaActions}>
            <TouchableOpacity
              style={s.ctaPrimary}
              onPress={() => router.replace('/(auth)/welcome' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-forward" size={16} color="#0A0A0F" />
              <Text style={s.ctaPrimaryText}>Start a family</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.ctaGhost}
              onPress={() => router.push('/the-parlor' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.ctaGhostText}>Read more in the parlor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.xl },

  masthead: {
    paddingTop: Spacing.lg,
    gap: 14,
    alignItems: 'flex-start',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  title: {
    fontSize: 50,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  lede: {
    fontSize: 19,
    lineHeight: 32,
    color: Colors.textSecondary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any)
      : {}),
  },
  flourishRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
  },
  flourishRule: {
    width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55,
  },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  body: {
    fontSize: 18,
    lineHeight: 30,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },
  bodyEm: { color: Colors.brandIvory, fontWeight: '600' },

  faq: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  faqQ: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.brandIvory,
    letterSpacing: -0.2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  faqA: {
    fontSize: 16,
    lineHeight: 26,
    color: Colors.textSecondary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any)
      : {}),
  },

  cta: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderWidth: 1, borderColor: Colors.primary,
    gap: 10,
  },
  ctaTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  ctaBody: {
    fontSize: 16, lineHeight: 26, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  ctaActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm, flexWrap: 'wrap' },
  ctaPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  ctaPrimaryText: { color: '#0A0A0F', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  ctaGhost: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  ctaGhostText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
}); }
