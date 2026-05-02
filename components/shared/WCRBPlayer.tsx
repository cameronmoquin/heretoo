/**
 * WCRB classical music player — small persistent widget.
 *
 * 99.5 FM Boston, WGBH's classical stream. We embed an HTML5 <audio>
 * pointing at WCRB's live stream URLs and try them in order — public-
 * radio streams move endpoints periodically, so falling through a
 * known list of candidates is more robust than pinning to one URL.
 *
 * Web-only on this round — native would need react-native-track-
 * player. The widget renders nothing on iOS/Android.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';

// WCRB live stream candidates — tried in order. The widget logs
// a console warning if every one of them fails so you can swap in
// a better URL if WGBH ever moves the endpoint.
const STREAM_URLS = [
  // Primary: StreamTheWorld AAC (most public-radio stations use TritonDigital/StreamTheWorld)
  'https://13703.live.streamtheworld.com/WGBHFM_FMAAC_SC',
  // Backup: iHeart's RevMa relay
  'https://stream.revma.ihrhls.com/zc7261',
  // StreamGuys MP3 (was the historical WGBH endpoint)
  'https://wgbh-sc.streamguys1.com/wgbh-classical-mp3',
  'https://wgbh-sc.streamguys1.com/wgbh-classical',
  // HLS as a last resort (Safari + modern browsers handle it natively)
  'https://classicalwcrb.streamguys1.com/listen.m3u8',
];

interface Props {
  /** Compact mode — single tappable row, used in the mobile profile hub. */
  compact?: boolean;
}

export function WCRBPlayer({ compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlIdxRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (audioRef.current) return;

    const a = new Audio();
    a.preload = 'none';
    a.crossOrigin = 'anonymous';   // hint for CORS-friendly streams
    a.src = STREAM_URLS[0];

    a.addEventListener('playing', () => { setPlaying(true); setError(null); });
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('ended', () => setPlaying(false));

    // On error, silently try the next URL in the list before giving up.
    a.addEventListener('error', () => {
      urlIdxRef.current += 1;
      if (urlIdxRef.current < STREAM_URLS.length) {
        const next = STREAM_URLS[urlIdxRef.current];
        // eslint-disable-next-line no-console
        console.warn(`[WCRB] stream ${urlIdxRef.current} failed, trying ${next}`);
        a.src = next;
        // If we were trying to play, attempt the next one immediately.
        if (!a.paused) a.play().catch(() => {});
      } else {
        // eslint-disable-next-line no-console
        console.error('[WCRB] all stream URLs failed');
        setError("Stream is offline. We'll try again next play.");
        setPlaying(false);
        // Reset the index so the user can retry from URL 0 next press.
        urlIdxRef.current = 0;
        a.src = STREAM_URLS[0];
      }
    });

    audioRef.current = a;
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    setError(null);
    try {
      if (a.paused) {
        // Reset to the primary URL on each new play attempt — gives
        // moved-endpoint situations a chance to recover automatically.
        urlIdxRef.current = 0;
        a.src = STREAM_URLS[0];
        await a.play();
      } else {
        a.pause();
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[WCRB] play() rejected', e);
      setError(e?.message ?? 'Could not start the stream.');
    }
  };

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
            {error ?? (playing ? 'Now playing — 99.5 FM' : 'Classical · Tap to play')}
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
          <Text style={s.sub}>
            {error ? 'Stream offline' : (playing ? 'Streaming live' : 'Boston · WGBH')}
          </Text>
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
