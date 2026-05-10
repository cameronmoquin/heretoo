/**
 * RoomMasthead — the visible "you are here" header for the Room.
 *
 * Source of Truth, M10 codex. Rendered at the top of every Room view
 * before the hearth section. Carries the brand wordmark in Syne 800
 * with a centered gold rule and a dim ornamental glyph beneath. The
 * point is presence — when you scroll the Room you should always be
 * able to feel where you are.
 *
 * No links, no navigation. The LeftSidebar / MobileTabBar handle nav.
 * This is decoration: a plaque on the wall.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { ChimePanel } from '../easter/ChimePanel';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';

interface Props {
  /** Sub-line under the wordmark — the family or "Common" label. */
  subtitle?: string;
}

export function RoomMasthead({ subtitle }: Props) {
  const s = makeStyles();
  // Long-press the wordmark to open the chime panel — a discoverable
  // delight. Tap normally does nothing; you have to find this.
  const [chimes, setChimes] = useState(false);
  return (
    <View style={s.wrap}>
      <Pressable
        onLongPress={() => setChimes((v) => !v)}
        delayLongPress={650}
        accessibilityRole="header"
        accessibilityLabel="HereToo. Long-press to ring the bowls."
      >
        <Text style={s.brand} numberOfLines={1}>HereToo</Text>
      </Pressable>
      <View style={s.flourish}>
        <View style={s.rule} />
        <Text style={s.glyph}>✦</Text>
        <View style={s.rule} />
      </View>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {chimes && (
        <View style={{ width: '100%', maxWidth: 480, marginTop: Spacing.sm }}>
          <ChimePanel visible={chimes} onClose={() => setChimes(false)} />
        </View>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 6,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  flourish: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 4,
  },
  rule: {
    width: 48, height: 1,
    backgroundColor: Colors.primary,
    opacity: 0.55,
  },
  glyph: {
    fontSize: 10,
    color: Colors.primary,
    opacity: 0.85,
    letterSpacing: 0,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2.4,
    marginTop: 2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
}); }
