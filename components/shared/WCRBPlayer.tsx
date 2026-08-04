/**
 * Generic radio widget — reads from the singleton radioStore so playback
 * state is shared with the bottom-nav button, the /music station picker,
 * and any other surface. Renders the user's active station rather than
 * the original WCRB-only design.
 *
 * The component is named WCRBPlayer for back-compat with existing call
 * sites (profile hub, music tab, etc.). The export name stays. Future
 * renames are a sweep when convenient.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';

interface Props {
  /** Compact mode — single tappable row, used in the mobile profile hub. */
  compact?: boolean;
}

export function WCRBPlayer({ compact = false }: Props) {
  const s = makeStyles();
  const station = useActiveStation();
  const playing = useRadio((s) => s.playing);
  const loading = useRadio((s) => s.loading);
  const error = useRadio((s) => s.error);
  const toggle = useRadio((s) => s.toggle);

  if (Platform.OS !== 'web') return null;

  const onToggle = () => { toggle().catch(() => {}); };
  const onChangeStation = () => router.replace('/(tabs)/music' as any);

  if (compact) {
    return (
      <View style={s.compactWrap}>
        <TouchableOpacity
          style={s.compactRow}
          onPress={onToggle}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${station.name}` : `Play ${station.name}`}
        >
          <View style={s.iconRing}>
            <Ionicons
              name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'}
              size={14}
              color={Colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.compactTitle}>{station.name}</Text>
            <Text style={s.compactSub} numberOfLines={1}>
              {error ?? (
                playing
                  ? `Now playing · ${station.genre}`
                  : station.genre
              )}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onChangeStation}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Change station"
          >
            <Ionicons name="swap-horizontal-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="musical-notes-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.eyebrow}>{station.genre.toUpperCase()} · {station.city}</Text>
      </View>
      <View style={s.row}>
        <TouchableOpacity
          style={s.playBtn}
          onPress={onToggle}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${station.name}` : `Play ${station.name}`}
        >
          <Ionicons
            name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{station.name}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {error ?? (playing ? 'Streaming live' : station.blurb)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onChangeStation}
          style={s.changeBtn}
          accessibilityLabel="Change station"
        >
          <Ionicons name="swap-horizontal-outline" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  changeBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  errorText: { fontSize: 11, color: Colors.error, marginTop: 6 },

  // Compact variant — single row inside profile hub
  compactWrap: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  compactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  iconRing: {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  compactTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  compactSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
}); }
