/**
 * PostPhoto — a photo at its natural aspect ratio, full column width,
 * capped so a tall photo does not take over the page.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Radius } from '../../../constants/design';

export function PostPhoto({ uri, maxHeight = 520 }: { uri: string; maxHeight?: number }) {
  const [ratio, setRatio] = useState(4 / 3);
  useEffect(() => {
    let live = true;
    Image.getSize(uri, (w, h) => { if (live && w && h) setRatio(Math.max(w / h, 0.6)); }, () => {});
    return () => { live = false; };
  }, [uri]);
  const s = makeStyles();
  return (
    <Image
      source={{ uri }}
      style={[s.img, { aspectRatio: ratio, maxHeight }]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

function makeStyles() { return StyleSheet.create({
  img: { width: '100%', borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt },
}); }

/**
 * PostPhotos — a post's photos (up to five). One photo shows full width
 * at its own shape; several show as a two-across grid of squares. In a
 * compact card only the first shows, with a "+N" corner when there are
 * more.
 */
export function PostPhotos({ paths, toUri, compact }: {
  paths: string[]; toUri: (path: string) => string; compact?: boolean;
}) {
  const g = makeGridStyles();
  if (paths.length === 0) return null;
  if (paths.length === 1) return <PostPhoto uri={toUri(paths[0])} maxHeight={compact ? 240 : 520} />;
  if (compact) {
    return (
      <View style={g.single}>
        <PostPhoto uri={toUri(paths[0])} maxHeight={240} />
        <View style={g.more}><Text style={g.moreText}>+{paths.length - 1}</Text></View>
      </View>
    );
  }
  return (
    <View style={g.grid}>
      {paths.map((p, i) => (
        <Image
          key={`${p}-${i}`}
          source={{ uri: toUri(p) }}
          // An odd last photo spans the full row so the grid has no hole.
          style={[g.cell, paths.length % 2 === 1 && i === paths.length - 1 ? g.cellWide : null]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ))}
    </View>
  );
}

function makeGridStyles() { return StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: '49.4%', aspectRatio: 1, borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt },
  cellWide: { width: '100%', aspectRatio: 2 },
  single: { position: 'relative' },
  more: {
    position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radius.control, backgroundColor: Colors.primary,
  },
  moreText: { color: Colors.onPrimary, fontSize: 13, fontWeight: '700' },
}); }
