/**
 * /about — one-page philosophy.
 *
 * Source of Truth, Milestone 11. Public-indexed marketing surface.
 * Names what HereToo is in plain language for someone who has never
 * heard of it. Ends with a single muted "Step inside" link, no
 * email capture, no signup wall.
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
          <Text style={s.kicker}>HereToo</Text>
          <Text style={s.title}>Secrets worth leaving the house for.</Text>
        </View>

        <Text style={s.body}>
          A private world for the people you actually trust. Post, share, write a
          letter someone opens in five years, or hide a message at a real spot on
          the map and make them go find it.
        </Text>

        <Text style={s.body}>
          Some things vanish the moment they are read. Some stay sealed until you
          are standing in the right place. Nothing here is performing for strangers.
        </Text>

        <View style={s.huntCard}>
          <Text style={s.huntKicker}>Deaddrop</Text>
          <Text style={s.huntTitle}>Hide a cache. Chase the arrow.</Text>
          <Text style={s.huntBody}>
            Drop a pin where you stand, stash a toy or a treat, and share a code.
            The seeker punches it in and follows a live compass and a hot-or-cold
            readout to the exact spot. Works anywhere outdoors. Free, no signup.
          </Text>
          <Text style={s.huntUses}>
            Backyard treasure hunts, birthday parties, classroom waypoints, a
            bar-crawl dare.
          </Text>
          <TouchableOpacity
            style={s.huntCta}
            onPress={() => router.push('/hunt' as any)}
            activeOpacity={0.85}
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
          >
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
            <Text style={s.ctaText}>Step inside</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.ctaAlt}
            onPress={() => router.push('/the-parlor' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.ctaAltText}>Read the parlor</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },

  masthead: { gap: 6 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  body: {
    fontSize: 19, lineHeight: 32, color: Colors.textPrimary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
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
  huntTitle: {
    fontSize: 24, fontWeight: '800', letterSpacing: -0.3, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  huntBody: {
    fontSize: 17, lineHeight: 28, color: Colors.textPrimary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },
  huntUses: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary, fontStyle: 'italic' },
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
  ctaAlt: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  ctaAltText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
}); }
