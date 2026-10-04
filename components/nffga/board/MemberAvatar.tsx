/**
 * MemberAvatar — the member's photo, or their initial in a circle.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Radius } from '../../../constants/design';
import { publicObjectUrl } from '../../../lib/nffga/types';

export function MemberAvatar({ name, path, uri, size = 72 }: {
  name?: string | null; path?: string | null; uri?: string | null; size?: number;
}) {
  const s = makeStyles();
  const src = uri ?? (path ? publicObjectUrl('nffga-media', path) : null);
  const box = { width: size, height: size, borderRadius: Radius.pill };
  if (src) return <Image source={{ uri: src }} style={[s.img, box]} accessibilityIgnoresInvertColors />;
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[s.blank, box]}>
      <Text style={[s.initial, { fontSize: Math.round(size * 0.4) }]}>{initial}</Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  img: { backgroundColor: Colors.surfaceAlt },
  blank: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  initial: { fontWeight: '600', color: Colors.textSecondary },
}); }
