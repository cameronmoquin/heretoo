import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';

interface AvatarProps {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  borderColor?: string;
}

// Warm color palette for avatar backgrounds based on initials
const AVATAR_COLORS = [
  '#E8D5B7', '#B7D5E8', '#D5E8B7', '#E8B7D5',
  '#B7E8D5', '#D5B7E8', '#E8C9B7', '#B7C9E8',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ url, name, size = 40, borderColor }: AvatarProps) {
  const displayName = name ?? '?';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const bgColor = getAvatarColor(displayName);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderColor: borderColor ?? 'transparent',
          borderWidth: borderColor ? 2 : 0,
        },
      ]}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: size * 0.36 },
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#5C4A32',
    fontFamily: Fonts.bodySemiBold,
  },
});
