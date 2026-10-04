/**
 * PostPhoto — a photo at its natural aspect ratio, full column width,
 * capped so a tall photo does not take over the page.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
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
