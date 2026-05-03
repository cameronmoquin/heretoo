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

      {/* Top-right tag */}
      <View style={s.tagWrap} pointerEvents="none">
        <Text style={[s.tag, isAd ? s.tagAd : s.tagArt]}>
          {isAd ? 'Sponsored' : 'From the gallery'}
        </Text>
      </View>

      {/* Bottom scrim — single translucent slab for legibility. */}
      <View pointerEvents="none" style={[s.scrim, s.scrim1]} />

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

  // Single bottom scrim — rgba layered on top of the image. Avoids the
  // percentage-height stack that was wedging RN-Web layout earlier.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  scrim1: { backgroundColor: 'rgba(0,0,0,0.55)' },

  text: {
    position: 'absolute',
    left: 12, right: 12, bottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,                       // was 18 — fits the slimmer bar
    fontWeight: '800',
    letterSpacing: -0.1,
    lineHeight: 18,
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
  tagAd: { color: '#FFF', backgroundColor: Colors.primary },
  tagArt: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
}); }
