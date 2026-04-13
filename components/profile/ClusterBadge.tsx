import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { CLUSTER_BY_ID } from '../../constants/clusters';

interface ClusterBadgeProps {
  clusterId: number;
  confidence: number;
}

export function ClusterBadge({ clusterId, confidence }: ClusterBadgeProps) {
  const cluster = CLUSTER_BY_ID[clusterId];
  if (!cluster) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: cluster.displayColor }]} />
      <Text style={styles.text}>{cluster.description}</Text>
      {confidence > 0.5 && (
        <Text style={styles.confidence}>
          {Math.round(confidence * 100)}% fit
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  confidence: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
