/**
 * SitePhotoStrip — the association's own photos for one placement
 * (nffga_site_photos, managed at /admin → Photos). A horizontal strip on
 * a phone, a wrapping grid on a wide screen. Renders nothing when the
 * placement has no photos, so pages look exactly as before until an
 * admin adds one.
 */
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { sitePhotoUrl, useSitePhotos, type SitePhotoPlacement } from '../../lib/nffga/siteAdmin';

export function SitePhotoStrip({ placement, style }: { placement: SitePhotoPlacement; style?: ViewStyle }) {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const q = useSitePhotos(placement);
  const photos = q.data ?? [];
  if (photos.length === 0) return null;
  const wide = width >= 900;

  const tiles = photos.map((p) => (
    <View key={p.id} style={wide ? s.cellWide : s.cell}>
      <Image
        source={{ uri: sitePhotoUrl(p.path) }}
        style={s.img}
        resizeMode="cover"
        accessibilityLabel={p.caption ?? 'Photo'}
        accessibilityIgnoresInvertColors
      />
      {p.caption ? <Text style={s.caption} numberOfLines={2}>{p.caption}</Text> : null}
    </View>
  ));

  return (
    <View style={[s.wrap, style]}>
      {wide ? (
        <View style={s.grid}>{tiles}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>{tiles}</ScrollView>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { width: '100%' },
  strip: { gap: Spacing.sm, paddingHorizontal: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: 240, gap: Spacing.xxs },
  cellWide: { flexGrow: 1, flexBasis: 240, maxWidth: 360, gap: Spacing.xxs },
  img: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt },
  caption: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
}); }
