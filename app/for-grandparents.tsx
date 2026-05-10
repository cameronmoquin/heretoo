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
    q: 'Is HereToo really for grandparents?',
    a: 'Yes. The platform was built around the idea that a 65-year-old should want it for her own sake — slow, beautiful, voice-readable, with a daily noon email summary instead of constant notifications. The 14-year-old grandchild also has reasons to be on it, but the room was decorated with the grandmother in mind first.',
  },
  {
    q: 'How do I sign my mother up?',
    a: "You start a family on HereToo, then send her a printed welcome card from the family page. When she scans the QR code, the platform reads her a 30-second greeting in a calm voice that names you. There are no fields, no signup wall — she taps once and she's inside the room you decorated for her.",
  },
  {
    q: 'Is it like Facebook?',
    a: 'No. Facebook is loud, public, ad-driven, and runs on follower counts and infinite scroll. HereToo is quiet, private to your family, has no ads, no follower counts, and the home screen has three posts a day at most. The two products solve different problems.',
  },
  {
    q: 'Does it cost money?',
    a: "Five dollars a month or fifty a year, paid by the family for the family. The grandmother never sees a price. One adult in the family covers everyone. The first family is free for trial use.",
  },
  {
    q: 'Will my mother be able to use it?',
    a: 'The interface is intentionally minimal. Three taps to read what your family shared today. Voice input for posts and messages — she can speak, the platform transcribes. A calm voice will read posts aloud while she does the dishes. Type is large by default. There is no "complete your profile" prompt and the platform never asks for her birthday.',
  },
  {
    q: 'Can she write a letter to a grandchild not yet born?',
    a: "Yes. The Letter feature lets her queue a long-form letter for delivery on a chosen date up to 80 years out. She can address it to a future grandchild she hasn't met yet. The letter arrives by email — addressed care-of a parent if the grandchild is still small.",
  },
  {
    q: 'What about her privacy?',
    a: 'HereToo never sells data and runs no advertising. There are no third-party tracking pixels. Posts are visible only to the family they were posted to. Direct messages from outside the family network require explicit acceptance. The grandmother is the user, not the product.',
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
          <Text style={s.kicker}>For grandmothers, grandfathers, and the people who love them</Text>
          <Text style={s.title}>The social media of your dreams.</Text>
          <Text style={s.lede}>
            Quiet. Private to your family. No ads, no follower counts, no
            algorithm. Three posts on the mantel a day. A calm voice reads them
            aloud while you do the dishes. The platform was decorated with you
            in mind first.
          </Text>
          <View style={s.flourishRow}>
            <View style={s.flourishRule} />
            <Text style={s.flourishGlyph}>✦</Text>
            <View style={s.flourishRule} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>What it is</Text>
          <Text style={s.body}>
            HereToo is a private social platform for families. Each family is a
            small, invitation-only room — your children, grandchildren, in-laws,
            and whoever else you want to gather. The default surface is not a
            feed. It is a room with wallpaper you choose, the music you last
            played humming at low volume, and a few postcards on the mantel
            from your family that day.
          </Text>
          <Text style={s.body}>
            You read what your family shared. You leave a heart, a comment, or
            you let a calm voice read it back to you. You write a post by
            speaking, if typing is hard, and the platform transcribes it. You
            queue a letter to be delivered on a date you choose, even years
            from now, even to a grandchild not yet born.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>What it isn&apos;t</Text>
          <Text style={s.body}>
            The family rooms — the parlor, the letters, the memoir, the trivia,
            every private surface — run no advertising. The public square area
            of HereToo is supported by ads, plainly disclosed before you enter.
            There are no tracking pixels for the family rooms, no third-party
            data partners, no infinite scroll, no streaks, no notification nudges,
            no &quot;people you may know&quot; from outside your family graph. There is
            no follower count anywhere on the platform.
          </Text>
          <Text style={s.body}>
            We do not collect your birthday or your phone number or your address
            book. We do not auto-suggest content or auto-write your replies. We
            do not let bots impersonate real people, living or dead. The
            platform&apos;s job is to leave you alone with the people you love,
            instead of pulling your face back into the glass.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>How it works</Text>
          <Text style={s.body}>
            <Text style={s.bodyEm}>Your daughter or grandchild starts a family.</Text>{' '}
            They give it a name (often a last name; sometimes something
            warmer, like &quot;The Cottage&quot; or &quot;Sunday Lunch&quot;). They invite
            you with a printed welcome card sent by mail. The card has a QR
            code on the back.
          </Text>
          <Text style={s.body}>
            <Text style={s.bodyEm}>You scan it.</Text>{' '}
            The platform plays a 30-second voice greeting in a calm voice that
            names you and names the person who invited you. There are no fields
            and no signup wall. You tap once and you are in the room your family
            decorated for you.
          </Text>
          <Text style={s.body}>
            <Text style={s.bodyEm}>You can come back any time.</Text>{' '}
            A daily email lands in your inbox at noon, listing what your family
            posted that you haven&apos;t read yet. If you close the app for two
            weeks, the platform welcomes you back without scolding you for
            missing days.
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
