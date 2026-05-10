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
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Game {
  slug: string;
  name: string;
  blurb: string;
  available: boolean;
  glyph: string;
}

const GAMES: Game[] = [
  {
    slug: 'tetris',
    name: 'Blocks',
    blurb: 'The falling-blocks classic. Stack rows; clear them; never get pinned.',
    available: true,
    glyph: '◧',
  },
  {
    slug: 'solitaire',
    name: 'Solitaire',
    blurb: "Klondike, the version your father played. Coming next week.",
    available: false,
    glyph: '♠',
  },
  {
    slug: 'match',
    name: 'Three in a Row',
    blurb: 'Match three or more in any direction. The candy game without the candy.',
    available: false,
    glyph: '◆',
  },
  {
    slug: 'pacman',
    name: 'The Maze',
    blurb: "Eat the dots. Don't get caught. Coming.",
    available: false,
    glyph: '◉',
  },
  {
    slug: 'crossword',
    name: 'Crossword',
    blurb: 'A new mini crossword once a day. Built from public-domain word lists.',
    available: false,
    glyph: '#',
  },
];

export default function GamesIndex() {
  const s = makeStyles();

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
          <Text style={s.kicker}>The Games Room</Text>
          <Text style={s.title}>Play in peace.</Text>
          <Text style={s.lede}>
            Calm versions of the classics. No ads, no full-screen video before
            every move, no &quot;continue?&quot; popups, no daily quest XP. The same games,
            the way they used to be.
          </Text>
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
              <Text style={s.cardBlurb}>{g.blurb}</Text>
              {!g.available && <Text style={s.cardSoonLabel}>Coming</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center' },

  masthead: { gap: 14 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2.4,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  title: {
    fontSize: 50, lineHeight: 56, fontWeight: '800', letterSpacing: -1.2,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  lede: {
    fontSize: 17, lineHeight: 28, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  flourishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  flourishRule: { width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55 },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  grid: { gap: Spacing.md },
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderWidth: 1, borderColor: Colors.primary,
    gap: 8,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  cardSoon: {
    borderColor: Colors.border, opacity: 0.65,
    backgroundColor: 'rgba(22, 22, 29, 0.5)',
  },
  cardGlyph: {
    fontSize: 36, color: Colors.primary, lineHeight: 36,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  cardName: {
    fontSize: 22, fontWeight: '800', color: Colors.brandIvory, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  cardBlurb: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  cardSoonLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2,
    textTransform: 'uppercase',
  },
}); }
