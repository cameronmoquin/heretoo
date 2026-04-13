import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface TrustScoreRingProps {
  score: number; // 0.0 to 1.0
  size?: number;
}

export function TrustScoreRing({ score, size = 80 }: TrustScoreRingProps) {
  const percent = Math.round(score * 100);
  const label =
    percent >= 80
      ? 'Trusted'
      : percent >= 50
      ? 'Building'
      : percent >= 20
      ? 'New'
      : 'Starting';

  const color =
    percent >= 80
      ? Colors.badgeCommonGround
      : percent >= 50
      ? Colors.badgeBridging
      : percent >= 20
      ? Colors.badgeReaching
      : Colors.textMuted;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
          },
        ]}
      >
        <Text style={[styles.score, { color, fontSize: size * 0.3 }]}>
          {percent}
        </Text>
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  ring: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
