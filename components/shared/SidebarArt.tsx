/**
 * Sidebar art slot — a single rotating artwork pinned to the bottom
 * of the desktop sidebar. The same gallery the inline post-feed slot
 * draws from. Tap to open the source page (museum URL).
 *
 * Quietly serves as ad inventory eventually: when source='ad' rows
 * exist they get prioritized by useArtFeed.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { useArtFeed } from '../../hooks/useArtFeed';
import { useBrokenArt, pickArtAroundAnchor } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export function SidebarArt() {
  const s = makeStyles();
  const { data: art } = useArtFeed();

  // Sidebar takes the middle of the shuffled pool (banners take 0 and
  // length-1). Walk outward past any pieces that have 404'd this
  // session.
  const broken = useBrokenArt((s) => s.broken);
  const markBroken = useBrokenArt((s) => s.markBroken);
  const piece = useMemo(() => {
    const pool = art ?? [];
    if (pool.length === 0) return null;
    return pickArtAroundAnchor(pool, Math.floor(pool.length / 2), broken);
  }, [art, broken]);

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
    <Pressable style={s.wrap} onPress={open} disabled={!piece.source_url}>
      <Image
        source={{ uri: piece.thumb_path ?? piece.storage_path }}
        style={s.img}
        resizeMode="cover"
        onError={() => markBroken(piece.id)}
      />
      <View style={s.meta}>
        <Text style={s.tag}>{isAd ? 'Sponsored' : 'From the gallery'}</Text>
        {!!piece.title && <Text style={s.title} numberOfLines={2}>{piece.title}</Text>}
        {!!piece.artist && <Text style={s.artist} numberOfLines={1}>{piece.artist}</Text>}
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceLight,
  },
  meta: { padding: 10, gap: 2 },
  tag: {
    fontSize: 9, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  title: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  artist: { fontSize: 11, color: Colors.textSecondary },
}); }
