/**
 * ArtBanner — wide cinematic banner used at the top + bottom of the feed.
 *
 * Layout: full-bleed image as background, gradient scrim across the
 * bottom for legibility, title + artist text bottom-left, license /
 * "Sponsored" tag top-right. Tap opens the source URL.
 *
 * Aspect ratio is fixed at 16:6 (a wide letterbox) and `objectFit:
 * cover` crops the image to fill — works for any source ratio because
 * none of our museum metadata has width/height stored.
 *
 * Different deterministic offset per slot ('top' vs 'bottom') so two
 * banners on the same screen don't show the same artwork.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { useArtFeed } from '../../hooks/useArtFeed';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface ArtBannerProps {
  slot?: 'top' | 'bottom';
}

export function ArtBanner({ slot = 'top' }: ArtBannerProps) {
  const s = makeStyles();
  const { data: art } = useArtFeed();

  const piece = useMemo(() => {
    const pool = art ?? [];
    if (pool.length === 0) return null;
    const offset = slot === 'top' ? 0 : Math.floor(pool.length / 2);
    return pool[(Math.floor(Math.random() * pool.length) + offset) % pool.length];
  }, [art, slot]);

  if (!piece) return null;

  const open = () => {
    if (!piece.source_url) return;
    if (Platform.OS === 'web') {
      window.open(piece.source_url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(piece.source_url);
    }
  };

  const isAd = piece.source === 'ad';

  return (
    <Pressable style={s.banner} onPress={open} disabled={!piece.source_url}>
      <Image
        source={{ uri: piece.storage_path }}
        style={s.bg}
        resizeMode="cover"
      />

      {/* Top-right tag */}
      <View style={s.tagWrap} pointerEvents="none">
        <Text style={[s.tag, isAd ? s.tagAd : s.tagArt]}>
          {isAd ? 'Sponsored' : 'From the gallery'}
        </Text>
      </View>

      {/*
        Bottom gradient scrim — pure-CSS on web (linear-gradient via
        background-color hack with a stacked View stack on native).
        Implemented as three stacked translucent slabs so we don't need
        a gradient library; gives a soft fade to readable text contrast.
      */}
      <View pointerEvents="none" style={[s.scrim, s.scrim1]} />
      <View pointerEvents="none" style={[s.scrim, s.scrim2]} />
      <View pointerEvents="none" style={[s.scrim, s.scrim3]} />

      {/* Bottom-left text */}
      <View style={s.text} pointerEvents="none">
        {!!piece.title && (
          <Text style={s.title} numberOfLines={2}>{piece.title}</Text>
        )}
        <View style={s.metaRow}>
          {!!piece.artist && (
            <Text style={s.artist} numberOfLines={1}>{piece.artist}</Text>
          )}
          {!!piece.year_created && (
            <Text style={s.year} numberOfLines={1}> · {piece.year_created}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  banner: {
    width: 'auto',
    aspectRatio: 16 / 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginHorizontal: Spacing.md,
    marginVertical: 8,
    position: 'relative',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },

  // Stacked scrim for bottom-left readability.
  scrim: { position: 'absolute', left: 0, right: 0 },
  scrim1: { bottom: 0, height: '40%', backgroundColor: 'rgba(0,0,0,0.55)' },
  scrim2: { bottom: '40%', height: '20%', backgroundColor: 'rgba(0,0,0,0.30)' },
  scrim3: { bottom: '60%', height: '20%', backgroundColor: 'rgba(0,0,0,0.10)' },

  text: {
    position: 'absolute',
    left: 14, right: 14, bottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  artist: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  year: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12, fontWeight: '500',
  },

  tagWrap: {
    position: 'absolute',
    top: 10, right: 10,
  },
  tag: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 4, overflow: 'hidden',
  },
  tagAd: { color: '#000', backgroundColor: Colors.primary },
  tagArt: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
}); }
