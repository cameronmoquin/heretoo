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
import { Layout, Radius, Type } from '../../constants/design';
import { artAspect } from '../../lib/artAspect';

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

  const fit = artAspect(piece.width, piece.height, 640 / 88);
  const isAd = piece.source === 'ad';

  return (
    /* The banner takes the piece's shape (lib/artAspect) instead of
       cropping the piece to an 88px strip — which showed a portrait
       poster as a horizontal sliver of its own middle. A tall piece
       makes a tall banner; that is the poster rule being visible
       rather than beheaded. */
    <Pressable
      style={[s.banner, { aspectRatio: fit.aspectRatio }]}
      onPress={open}
      disabled={!piece.source_url}
    >
      <Image
        source={{ uri: piece.storage_path }}
        style={s.bg}
        resizeMode={fit.resizeMode}
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
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.media,
    overflow: 'hidden',
    marginVertical: 6,
    // Sits inside the column, inset to the same gutter the rows use.
    marginHorizontal: Layout.rowPaddingHorizontal,
    position: 'relative',
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
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
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
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    // Same strong-shadow legibility as the credit, no background band.
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Sponsored stays a real pill — distinguishes it visually from
  // organic gallery items per FTC native-ad clarity.
  tagAd: {
    color: Colors.onPrimary,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.control,
    overflow: 'hidden',
  },
  tagArt: {
    color: 'rgba(255,255,255,0.9)',
  },
}); }
