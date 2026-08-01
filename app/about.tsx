/**
 * /about — the door.
 *
 * Source of Truth, Milestone 11. Public-indexed. No pitch, no
 * onboarding, no email capture, no signup wall. Two ways in.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type } from '../constants/design';
import { Button } from '../components/shared/Button';
import { Eyebrow } from '../components/shared/Eyebrow';

export default function AboutScreen() {
  const s = makeStyles();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.masthead}>
          <Text style={s.title}>HereToo</Text>
        </View>

        <View style={s.huntCard}>
          <Eyebrow accentColor={Colors.primary}>Deaddrop</Eyebrow>
          <Button
            title="Open Deaddrop"
            onPress={() => router.push('/hunt' as any)}
            variant="primary"
            style={s.pillCta}
            icon={<Ionicons name="navigate" size={16} color={Colors.onPrimary} />}
          />
        </View>

        <View style={s.actions}>
          <Button
            title="Step inside"
            onPress={() => router.replace('/(auth)/welcome' as any)}
            variant="primary"
            style={s.pillCta}
            icon={<Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />}
          />
        </View>

        {/* Publisher-facing fair-use notice. It lived at the bottom of the
            News room. That room folded into the feed's News lens, and this
            is legal copy rather than explainer copy, so it needed a home
            instead of a deletion. */}
        <Text style={s.footnote}>
          News headlines and summaries appear on HereToo under standard fair-use
          practice for aggregators. The full reporting lives on the publisher&apos;s
          site. Support public broadcasting directly when you can.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },

  masthead: { gap: 6 },
  title: {
    fontSize: Type.hero.size,
    lineHeight: Type.hero.lineHeight,
    fontWeight: Type.hero.weight,
    letterSpacing: Type.hero.letterSpacing,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  huntCard: {
    gap: Spacing.xs, marginTop: Spacing.sm,
    padding: Spacing.lg, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  // Pill CTA. Button supplies the fill, the ink and the 44pt floor;
  // this only carries the shrink-wrap and the full round.
  pillCta: {
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },

  actions: {
    flexDirection: 'row', gap: Spacing.xs, paddingTop: Spacing.md, flexWrap: 'wrap',
  },
  footnote: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', lineHeight: 17, paddingTop: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
