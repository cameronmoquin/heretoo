/**
 * ArtBanner — horizontal slim art panel for top / bottom of feed.
 *
 * Pulls a single random piece from the art reservoir and renders it
 * as a square thumb on the left + title/artist text + a "View" cue.
 * Tap opens the source URL (museum or, eventually, advertiser).
 *
 * Slot uses different pieces per position so a Top + Bottom banner on
 * the same screen don't show the same artwork.
 */

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useArtFeed } from '../../hooks/useArtFeed';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface ArtBannerProps {
  /** Used to seed which piece to pick so two banners don't collide. */
  slot?: 'top' | 'bottom';
}

export function ArtBanner({ slot = 'top' }: ArtBannerProps) {
  const s = makeStyles();
  const { data: art } = useArtFeed();

  const piece = useMemo(() => {
    const pool = art ?? [];
    if (pool.length === 0) return null;
    // Different deterministic offset per slot so top + bottom differ.
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
    <Pressable style={s.bar} onPress={open} disabled={!piece.source_url}>
      <Image
        source={{ uri: piece.thumb_path ?? piece.storage_path }}
        style={s.thumb}
        resizeMode="cover"
      />
      <View style={s.text}>
        <Text style={s.tag}>{isAd ? 'Sponsored' : 'From the gallery'}</Text>
        <Text style={s.title} numberOfLines={1}>{piece.title ?? 'Untitled'}</Text>
        {!!piece.artist && <Text style={s.artist} numberOfLines={1}>{piece.artist}</Text>}
      </View>
      {!!piece.source_url && (
        <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 10,
    marginHorizontal: Spacing.md,
    marginVertical: 8,
  },
  thumb: {
    width: 56, height: 56, borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  text: { flex: 1, minWidth: 0 },
  tag: {
    fontSize: 9, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginBottom: 2,
  },
  title: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  artist: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
}); }
