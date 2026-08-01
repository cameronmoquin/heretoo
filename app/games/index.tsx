/**
 * /games — the games room.
 *
 * Calm, ad-free versions of the games that prey on older audiences
 * elsewhere on the internet. Single-player, no leaderboards across
 * platform, no daily-quest XP, no pop-ups. Just the game.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Gen } from '../../constants/generations';

interface Game {
  slug: string;
  name: string;
  available: boolean;
  glyph: string;
}

const GAMES: Game[] = [
  { slug: 'tetris', name: 'Blocks', available: true, glyph: '◧' },
  { slug: 'solitaire', name: 'Solitaire', available: false, glyph: '♠' },
  { slug: 'match', name: 'Three in a Row', available: false, glyph: '◆' },
  { slug: 'pacman', name: 'The Maze', available: false, glyph: '◉' },
  { slug: 'crossword', name: 'Crossword', available: false, glyph: '#' },
];

export default function GamesIndex() {
  const s = makeStyles();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ScreenHeader showBack style={s.header} />

        <View style={s.masthead}>
          <Eyebrow accentColor={Colors.primary}>The Games Room</Eyebrow>
          <Text style={s.title}>Play in peace.</Text>
          <View style={s.flourishRow}>
            <View style={s.flourishRule} />
            <Text style={s.flourishGlyph}>✦</Text>
            <View style={s.flourishRule} />
          </View>
        </View>

        <View style={s.grid}>
          {GAMES.map((g) => (
            <TouchableOpacity
              key={g.slug}
              style={[s.card, !g.available && s.cardSoon]}
              activeOpacity={g.available ? 0.85 : 1}
              disabled={!g.available}
              onPress={() => router.push(`/games/${g.slug}` as any)}
            >
              <Text style={s.cardGlyph}>{g.glyph}</Text>
              <Text style={s.cardName}>{g.name}</Text>
              {!g.available && <Eyebrow>Coming</Eyebrow>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },
  header: { paddingHorizontal: 0 },

  masthead: { gap: 14 },
  title: {
    fontSize: Type.hero.size, lineHeight: Type.hero.lineHeight,
    fontWeight: Type.hero.weight, letterSpacing: Type.hero.letterSpacing,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
  flourishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.xxs },
  flourishRule: { width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55 },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  grid: { gap: Spacing.md },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.primary,
    gap: Spacing.xs,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  // The unavailable card sinks back to the canvas instead of lifting.
  cardSoon: {
    borderColor: Colors.border, opacity: 0.65,
    backgroundColor: Colors.background,
  },
  cardGlyph: {
    fontSize: 36, color: Colors.primary, lineHeight: 36,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  cardName: {
    fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
}); }
