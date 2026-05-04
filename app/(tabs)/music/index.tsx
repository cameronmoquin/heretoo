/**
 * Music tab — multi-station picker.
 *
 * Was originally WCRB-only. Now lists every curated station in
 * radioStore.STATIONS, grouped by genre, with one row per station.
 * Tap a row to set it as the active station; tap the now-large
 * play/pause control at the top to start/stop playback.
 *
 * The active station is mirrored to profiles.style_prefs.radio_station_id
 * so visitors to /u/<handle> can see what someone is listening to,
 * and the bottom-nav play button toggles whichever station is active.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRadio, useActiveStation, STATIONS, type RadioStation } from '../../../stores/radioStore';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function MusicTab() {
  const active = useActiveStation();
  const playing = useRadio((s) => s.playing);
  const loading = useRadio((s) => s.loading);
  const error = useRadio((s) => s.error);
  const toggle = useRadio((s) => s.toggle);
  const setStation = useRadio((s) => s.setStation);

  // Group stations by genre for a tidy picker. Insertion order
  // preserved so the catalogue's curation order is visible.
  const byGenre = useMemo(() => {
    const map = new Map<string, RadioStation[]>();
    for (const s of STATIONS) {
      if (!map.has(s.genre)) map.set(s.genre, []);
      map.get(s.genre)!.push(s);
    }
    return [...map.entries()];
  }, []);

  const openHomepage = (url: string | undefined) => {
    if (!url) return;
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener,noreferrer');
    else Linking.openURL(url);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Active station hero */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={s.heroEyebrow}>Now playing</Text>
            <Text style={s.heroTitle}>{active.name}</Text>
            <Text style={s.heroSub}>
              {active.genre.replace(/^./, (c) => c.toUpperCase())} · {active.city}
            </Text>
            <Text style={s.heroBlurb} numberOfLines={3}>{active.blurb}</Text>
            {active.url && (
              <TouchableOpacity onPress={() => openHomepage(active.url)} style={s.heroLink}>
                <Ionicons name="open-outline" size={12} color={Colors.primary} />
                <Text style={s.heroLinkText}>Visit station</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={s.heroPlayBtn}
            onPress={toggle}
            activeOpacity={0.85}
            accessibilityLabel={playing ? 'Pause' : 'Play'}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {!!error && (
          <View style={s.errBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={s.errText}>{error}</Text>
          </View>
        )}

        {/* Picker grouped by genre */}
        {byGenre.map(([genre, stations]) => (
          <View key={genre} style={s.genreGroup}>
            <Text style={s.genreLabel}>{genre.toUpperCase()}</Text>
            {stations.map((station) => {
              const isActive = station.id === active.id;
              return (
                <TouchableOpacity
                  key={station.id}
                  style={[s.row, isActive && s.rowActive]}
                  onPress={() => setStation(station.id)}
                  activeOpacity={0.75}
                >
                  <View style={[s.rowDot, isActive && s.rowDotActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowName, isActive && s.rowNameActive]}>{station.name}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {station.city} · {station.blurb}
                    </Text>
                  </View>
                  {isActive && playing && (
                    <Ionicons name="volume-high" size={14} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={s.note}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
          <Text style={s.noteText}>
            All stations are listener-supported public radio or independent indie. Audio keeps streaming as you move around HereToo. Tap the play button in the bottom nav to toggle the active station from anywhere.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.md, gap: 12, maxWidth: 720, alignSelf: 'center', width: '100%' },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroEyebrow: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  heroSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  heroBlurb: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 6 },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  heroLinkText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  heroPlayBtn: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface,
    borderColor: Colors.error, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md,
  },
  errText: { fontSize: 12, color: Colors.error, flex: 1 },

  genreGroup: { gap: 4 },
  genreLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
    paddingHorizontal: 4, marginTop: 8, marginBottom: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  rowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  rowDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.border,
  },
  rowDotActive: { backgroundColor: Colors.primary },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  rowNameActive: { color: Colors.primary },
  rowMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  note: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md,
    padding: Spacing.sm, marginTop: 8,
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
