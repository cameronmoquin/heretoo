import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { getBridgeBadgeLevel, type BridgeBadgeLevel } from '../../lib/bridging';

interface BridgeScoreBadgeProps {
  clusterReach: number;
  bridgingScore: number;
}

const BADGE_CONFIG: Record<
  BridgeBadgeLevel,
  { label: string; color: string; bgColor: string }
> = {
  local: {
    label: 'Local',
    color: Colors.textMuted,
    bgColor: Colors.surfaceLight,
  },
  reaching: {
    label: 'Reaching',
    color: Colors.badgeReaching,
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  bridging: {
    label: 'Bridging',
    color: Colors.badgeBridging,
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
  common_ground: {
    label: 'Common Ground',
    color: Colors.badgeCommonGround,
    bgColor: 'rgba(232, 201, 122, 0.15)',
  },
};

export function BridgeScoreBadge({ clusterReach, bridgingScore }: BridgeScoreBadgeProps) {
  const level = getBridgeBadgeLevel(clusterReach);
  const config = BADGE_CONFIG[level];

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: config.bgColor }]}>
        <View style={[styles.dot, { backgroundColor: config.color }]} />
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      </View>
      {clusterReach > 0 && (
        <Text style={styles.reachText}>
          Heard across {clusterReach} {clusterReach === 1 ? 'community' : 'communities'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  reachText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
