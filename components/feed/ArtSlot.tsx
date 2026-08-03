/**
 * Inline art / ad slot for the feed.
 *
 * Renders an `art_works` row as a full-bleed card between regular posts.
 * If `art.source === 'ad'`, shows a "Sponsored" tag and links to source_url.
 * Otherwise it's a public-domain artwork with attribution + license badge.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking, Platform } from 'react-native';
import type { ArtWork } from '../../hooks/useArtFeed';
import { useBrokenArt } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Layout, Spacing, Radius, Type } from '../../constants/design';

interface ArtSlotProps {
  art: ArtWork;
}

export function ArtSlot({ art }: ArtSlotProps) {
  const s = makeStyles();
  const isAd = art.source === 'ad';
  const imgUri = art.storage_path;
  const markBroken = useBrokenArt((st) => st.markBroken);
  const broken = useBrokenArt((st) => st.broken);
  // If we already know this piece's image is dead, don't try to render
  // it at all — the parent feed list will pick a different one on the
  // next memo pass.
  if (broken.has(art.id)) return null;

  const onOpen = () => {
    if (!art.source_url) return;
    if (Platform.OS === 'web') {
      window.open(art.source_url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(art.source_url);
    }
  };

  return (
    <Pressable style={s.row} onPress={onOpen} disabled={!art.source_url}>
      <View style={s.tagRow}>
        <Text style={[s.tag, isAd ? s.tagAd : s.tagArt]}>
          {isAd ? 'Sponsored' : 'From the gallery'}
        </Text>
        {!isAd && !!art.license && (
          <Text style={s.license}>{art.license}</Text>
        )}
      </View>

      <Image
        source={{ uri: imgUri }}
        style={s.image}
        resizeMode="cover"
        onError={() => markBroken(art.id)}
      />

      <View style={s.meta}>
        {!!art.title && <Text style={s.title}>{art.title}</Text>}
        {!!art.artist && <Text style={s.artist}>{art.artist}</Text>}
        {!!art.year_created && <Text style={s.year}>{art.year_created}</Text>}
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  row: {
    paddingHorizontal: Layout.rowPaddingHorizontal,
    paddingVertical: Layout.rowPaddingVertical,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    overflow: 'hidden',
  },
  // Sponsored keeps a real fill. FTC native-ad clarity, not decoration.
  tagAd: {
    color: Colors.onPrimary, backgroundColor: Colors.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.control,
  },
  tagArt: { color: Colors.textMuted, backgroundColor: 'transparent' },
  license: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  image: {
    width: '100%', aspectRatio: 4 / 3,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.media,
  },
  meta: { gap: 2 },
  title: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  artist: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  year: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
}); }
