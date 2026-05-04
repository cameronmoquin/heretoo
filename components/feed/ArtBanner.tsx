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
import { useBrokenArt, pickArtAroundAnchor } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface ArtBannerProps {
  slot?: 'top' | 'bottom';
}

export function ArtBanner({ slot = 'top' }: ArtBannerProps) {
  const s = makeStyles();
  const { data: art } = useArtFeed();

  // Distinct anchor per slot, plus a walk-outward skip past any
  // pieces whose image URL has 404'd this session.
  const broken = useBrokenArt((s) => s.broken);
  const markBroken = useBrokenArt((s) => s.markBroken);
  const piece = useMemo(() => {
    const pool = art ?? [];
    if (pool.length === 0) return null;
    const anchorIdx = slot === 'top' ? 0 : pool.length - 1;
    return pickArtAroundAnchor(pool, anchorIdx, broken);
  }, [art, slot, broken]);

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
        onError={() => markBroken(piece.id)}
      />

      {/* Top-right tag — small and unobtrusive, no background band.
          'From the gallery' / 'Sponsored' is muted so it doesn't
          fight the artwork. */}
      <View style={s.tagWrap} pointerEvents="none">
        <Text style={[s.tag, isAd ? s.tagAd : s.tagArt]}>
          {isAd ? 'Sponsored' : 'From the gallery'}
        </Text>
      </View>

      {/* Inline credit — single small line, bottom-left, strong text-
          shadow for legibility on any background. No dark band. */}
      <View style={s.creditWrap} pointerEvents="none">
        <Text style={s.credit} numberOfLines={1}>
          {[
            piece.title || null,
            piece.artist || null,
            piece.year_created || null,
          ].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  banner: {
    width: '100%',
    height: 88,                       // slimmer — was 140; was eating the feed
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginVertical: 6,
    position: 'relative',
    alignSelf: 'center',
    maxWidth: 600,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
  },

  // Inline credit — small white text with a strong shadow. No dark
  // band. The shadow alone carries legibility on any background.
  creditWrap: {
    position: 'absolute',
    left: 10, right: 10, bottom: 6,
  },
  credit: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    // Strong layered shadow makes it read against light AND dark
    // crops of the image without a separate background band.
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  tagWrap: {
    position: 'absolute',
    top: 8, right: 10,
  },
  tag: {
    fontSize: 9, fontWeight: '600', letterSpacing: 1.2,
    textTransform: 'uppercase',
    // Same strong-shadow legibility as the credit, no background band.
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Sponsored stays a real pill — distinguishes it visually from
  // organic gallery items per FTC native-ad clarity.
  tagAd: {
    color: '#FFF',
    backgroundColor: Colors.primary,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    overflow: 'hidden',
  },
  tagArt: {
    color: 'rgba(255,255,255,0.9)',
  },
}); }
