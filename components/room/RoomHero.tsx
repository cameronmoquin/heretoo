/**
 * RoomHero — visual welcome card for the empty Room.
 *
 * Source of Truth, M1. The mantel needs presence even when nothing
 * has been posted yet. Instead of "Quiet day" alone, show a piece
 * of decoration that names the room — something that feels like
 * walking into a parlor, not opening a blank document.
 *
 * Renders only when there are no postcards to show. Once real posts
 * arrive, the hero hides and the postcards take the mantel.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallpaper, WALLPAPERS } from '../../stores/wallpaperStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  daysSinceLastPost: number | null;
  onCompose: () => void;
  onWriteLetter: () => void;
}

export function RoomHero({ daysSinceLastPost, onCompose, onWriteLetter }: Props) {
  const s = makeStyles();
  const wallpaperId = useWallpaper((w) => w.id);
  const wp = WALLPAPERS[wallpaperId as keyof typeof WALLPAPERS];
  const wpLabel = wp?.label ?? 'Plain';
  const wpEra = wp?.era ?? '';

  const lastPostLine =
    daysSinceLastPost === null
      ? 'Nothing posted here yet.'
      : daysSinceLastPost === 0
        ? 'Last post was today.'
        : daysSinceLastPost === 1
          ? 'Last post was yesterday.'
          : `Last post was ${daysSinceLastPost} days ago.`;

  return (
    <View style={s.card}>
      {/* Decorative inner gold frame — paper-mounted feel */}
      <View style={s.frame} pointerEvents="none" />

      <View style={s.body}>
        <Text style={s.kicker}>WELCOME TO THE ROOM</Text>

        <Text style={s.headline}>
          A quieter corner{'\n'}of the internet.
        </Text>

        <View style={s.flourishRow}>
          <View style={s.flourishRule} />
          <Text style={s.flourishGlyph}>·</Text>
          <View style={s.flourishRule} />
        </View>

        <Text style={s.body1}>
          The wall behind you is{' '}
          <Text style={s.bodyEm}>{wpLabel}</Text>
          {wpEra ? (
            <Text style={s.bodyMuted}> · {wpEra}</Text>
          ) : null}
          . The music plays at low volume in another room. The mantel holds
          three postcards a day. There is no further scroll.
        </Text>

        <Text style={s.body1}>
          {lastPostLine} You can write something, or write a letter to be
          delivered on a chosen day.
        </Text>

        <View style={s.actions}>
          <TouchableOpacity onPress={onCompose} style={s.btnPrimary} activeOpacity={0.85}>
            <Ionicons name="create-outline" size={14} color="#0A0A0F" />
            <Text style={s.btnPrimaryText}>Write a post</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onWriteLetter} style={s.btnGhost} activeOpacity={0.85}>
            <Ionicons name="mail-outline" size={14} color={Colors.primary} />
            <Text style={s.btnGhostText}>Write a letter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: 'rgba(22, 22, 29, 0.72)',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    paddingVertical: Spacing.xl + 4,
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    // Subtle inner glow — the candle effect
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as any) : {}),
  },
  // Inner gold hairline 12px in from the outer edge — paper-mounted look
  frame: {
    position: 'absolute',
    top: 12, left: 12, right: 12, bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.primary,
    opacity: 0.45,
    borderRadius: Radius.md,
  },
  body: { gap: 12, alignItems: 'center' },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 3.2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  headline: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    color: Colors.brandIvory,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  flourishRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2,
  },
  flourishRule: {
    width: 56, height: 1,
    backgroundColor: Colors.primary,
    opacity: 0.55,
  },
  flourishGlyph: {
    fontSize: 14,
    color: Colors.primary,
    opacity: 0.85,
  },
  body1: {
    fontSize: 15,
    lineHeight: 25,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  bodyEm: {
    color: Colors.brandIvory,
    fontStyle: 'italic',
  },
  bodyMuted: { color: Colors.textMuted, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row', gap: 10, marginTop: Spacing.sm, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    color: '#0A0A0F', fontSize: 13, fontWeight: '700', letterSpacing: 0.2,
  },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  btnGhostText: {
    color: Colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.2,
  },
}); }
