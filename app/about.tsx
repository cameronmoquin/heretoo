/**
 * /about — the door.
 *
 * Source of Truth, Milestone 11. Public-indexed. No pitch, no
 * onboarding, no email capture, no signup wall. Two ways in.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius } from '../constants/design';

export default function AboutScreen() {
  const s = makeStyles();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.masthead}>
          <Text style={s.title}>HereToo</Text>
        </View>

        <View style={s.huntCard}>
          <Text style={s.huntKicker}>Deaddrop</Text>
          <TouchableOpacity
            style={s.huntCta}
            onPress={() => router.push('/hunt' as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open Deaddrop"
          >
            <Ionicons name="navigate" size={16} color="#FFF" />
            <Text style={s.huntCtaText}>Open Deaddrop</Text>
          </TouchableOpacity>
        </View>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.cta}
            onPress={() => router.replace('/(auth)/welcome' as any)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Step inside"
          >
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
            <Text style={s.ctaText}>Step inside</Text>
          </TouchableOpacity>
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
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  huntCard: {
    gap: 8, marginTop: Spacing.sm,
    padding: Spacing.lg, borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  huntKicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  huntCta: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
    marginTop: 4, paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: Radius.full, backgroundColor: Colors.primary,
  },
  huntCtaText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },

  actions: {
    flexDirection: 'row', gap: 8, paddingTop: Spacing.md, flexWrap: 'wrap',
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  ctaText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  footnote: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', lineHeight: 17, paddingTop: Spacing.sm,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
