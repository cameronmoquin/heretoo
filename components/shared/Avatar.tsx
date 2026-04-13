import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Fonts } from '../../constants/typography';

const PALETTE = [
  '#FFD6E0', '#D4E4FF', '#D4F5D4', '#FFF0CC',
  '#E8D4FF', '#D4F0F5', '#FFE0CC', '#E0D4FF',
];

function pickColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

interface AvatarProps {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  borderColor?: string;
}

export function Avatar({ url, name, size = 38, borderColor }: AvatarProps) {
  const display = name ?? '?';
  const initials = display.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const bg = pickColor(display);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: borderColor ?? 'transparent', borderWidth: borderColor ? 2 : 0 }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: Fonts.bodySemiBold, color: '#4A4A4A' },
});
