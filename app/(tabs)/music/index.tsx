/**
 * Music tab — currently a single-station live page.
 *
 * Lives at /(tabs)/music and surfaces in the mobile bottom nav as
 * a Music icon. For now: WCRB classical only, presented as a hero
 * card. Future home for additional stations / playlists / saved
 * tracks.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WCRBPlayer } from '../../../components/shared/WCRBPlayer';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';

export default function MusicTab() {
  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroHeader}>
          <Ionicons name="musical-notes" size={20} color={Colors.primary} />
          <Text style={s.eyebrow}>Live radio</Text>
        </View>

        <Text style={s.title}>Classical Boston</Text>
        <Text style={s.sub}>
          WGBH's WCRB 99.5 FM, broadcasting symphony, opera, chamber music,
          and the great classical tradition from Boston.
        </Text>

        <View style={s.playerWrap}>
          <WCRBPlayer />
        </View>

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={s.noteText}>
            Audio plays in your browser. Keeps streaming as you move around HereToo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scroll: {
    padding: Spacing.md,
    gap: Spacing.sm,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  heroHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.xs,
  },
  eyebrow: {
    fontSize: Type.eyebrow.size, lineHeight: Type.eyebrow.lineHeight,
    fontWeight: Type.eyebrow.weight, letterSpacing: Type.eyebrow.letterSpacing,
    color: Colors.primary, textTransform: 'uppercase',
  },
  title: {
    fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight, letterSpacing: Type.display.letterSpacing,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textSecondary, marginBottom: Spacing.xs,
  },
  playerWrap: { marginHorizontal: -12 },   // counter the inner card margin
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 4, marginTop: Spacing.sm,
  },
  noteText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, flex: 1,
  },
});
