/**
 * WCRB classical music player — small persistent widget.
 *
 * 99.5 FM Boston, WGBH's classical stream. We embed an HTML5 <audio>
 * pointing at their public stream URL so a play/pause toggle is the
 * whole interface. No metadata fetching yet; if WGBH exposes a
 * "now playing" endpoint later, we can wire it in.
 *
 * Web-only on this round — native would need react-native-track-player
 * or expo-av, both of which add native bundle weight. The widget
 * just doesn't render on iOS/Android.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';

// WGBH's WCRB classical live stream. If the URL ever changes the
// rest of the widget keeps working — just swap the const.
const STREAM_URL = 'https://wgbh-sc.streamguys1.com/wgbh-classical';

interface Props {
  /** Compact mode: header collapsed, only the toggle visible. */
  compact?: boolean;
}

export function WCRBPlayer({ compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    // Lazy-create the audio element so it isn't constructed on screens
    // that never render this widget (mobile native, etc.)
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'none';
      a.src = STREAM_URL;
      a.addEventListener('playing', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('ended', () => setPlaying(false));
      a.addEventListener('error', () => setError('Stream is offline.'));
      audioRef.current = a;
    }
    return () => {
      // Don't tear down on unmount — let the user keep listening
      // across navigation. The audio element is reused next mount.
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    try {
      if (a.paused) {
        await a.play();
      } else {
        a.pause();
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not start the stream.');
    }
  };

  // Native: render nothing.
  if (Platform.OS !== 'web') return null;

  if (compact) {
    return (
      <TouchableOpacity style={s.compactRow} onPress={toggle} activeOpacity={0.8}>
        <View style={s.iconRing}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={14}
            color={Colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.compactTitle}>WCRB</Text>
          <Text style={s.compactSub}>
            {playing ? 'Now playing — 99.5 FM' : 'Classical · Tap to play'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="musical-notes-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.eyebrow}>Classical · 99.5 FM</Text>
      </View>
      <View style={s.row}>
        <TouchableOpacity style={s.playBtn} onPress={toggle} activeOpacity={0.85}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>WCRB</Text>
          <Text style={s.sub}>{playing ? 'Streaming live' : 'Boston · WGBH'}</Text>
        </View>
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontSize: Type.eyebrow.size, lineHeight: Type.eyebrow.lineHeight,
    fontWeight: Type.eyebrow.weight, letterSpacing: Type.eyebrow.letterSpacing,
    color: Colors.textMuted, textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 14, lineHeight: 18, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  sub: { fontSize: 11, lineHeight: 14, color: Colors.textSecondary, marginTop: 1 },
  errorText: { fontSize: 11, color: Colors.error },

  // Compact (used in mobile profile hub or anywhere tight)
  compactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  iconRing: {
    width: 32, height: 32, borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  compactTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.2 },
  compactSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});
