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
          <Text style={s.kicker}>About HereToo</Text>
          <Text style={s.title}>The room your family lives in.</Text>
        </View>

        <Text style={s.body}>
          HereToo is a quieter corner of the internet, made for the people you love.
          Family is the original lifeworld. The platform's job is to keep that lifeworld
          intact, not to replace it with content.
        </Text>

        <Text style={s.body}>
          Each user picks a wallpaper. Each family votes on a shared one. The feed is
          three postcards on a mantel, not an infinite scroll. Music plays at low
          volume in another room. A calm voice can read the day to you while you fold
          laundry. Letters can be queued for delivery years from now, addressed to a
          grandchild not yet born.
        </Text>

        <Text style={s.body}>
          We do not run advertising and we do not sell user data. The platform is
          paid for by a small family subscription. The grandmother never sees a price.
          The family pays it because the family wants the family to have a room.
        </Text>

        <Text style={s.body}>
          The destination is not a better social network. The destination is a place
          a grandmother decorates, dwells in, and gathers her family inside. The rest
          follows from that.
        </Text>

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
