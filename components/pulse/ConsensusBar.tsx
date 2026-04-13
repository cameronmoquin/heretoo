import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface ConsensusBarProps {
  bridgingScore: number;
  label?: string;
}

export function ConsensusBar({ bridgingScore, label }: ConsensusBarProps) {
  const percent = Math.round(bridgingScore * 100);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.barContainer}>
        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              {
                width: `${percent}%`,
                backgroundColor:
                  percent >= 70
                    ? Colors.badgeCommonGround
                    : percent >= 40
                    ? Colors.badgeBridging
                    : Colors.badgeReaching,
              },
            ]}
          />
        </View>
        <Text style={styles.percentText}>{percent}%</Text>
      </View>
      <Text style={styles.subtitle}>Cross-cluster agreement</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    width: 40,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
