import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Colors } from '../../constants/colors';
import { CLUSTERS } from '../../constants/clusters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_SIZE = SCREEN_WIDTH - 64;

interface ClusterPoint {
  x: number; // 0-1
  y: number; // 0-1
  clusterId: number;
}

interface ClusterMapProps {
  points: ClusterPoint[];
  activeVoterCount: number;
}

export function ClusterMap({ points, activeVoterCount }: ClusterMapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Opinion Map</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{activeVoterCount} voting now</Text>
        </View>
      </View>

      <View style={[styles.map, { width: MAP_SIZE, height: MAP_SIZE * 0.6 }]}>
        {/* Grid lines */}
        <View style={styles.gridLine} />
        <View style={[styles.gridLine, styles.gridLineV]} />

        {/* Points */}
        {points.map((point, i) => {
          const cluster = CLUSTERS.find((c) => c.id === point.clusterId);
          return (
            <View
              key={i}
              style={[
                styles.point,
                {
                  left: point.x * (MAP_SIZE - 12),
                  top: point.y * (MAP_SIZE * 0.6 - 12),
                  backgroundColor: cluster?.displayColor ?? Colors.textMuted,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {CLUSTERS.filter((c) => c.name !== 'unclassified').map((cluster) => (
          <View key={cluster.id} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: cluster.displayColor }]}
            />
            <Text style={styles.legendText}>{cluster.description}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.agree,
  },
  liveText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  map: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    left: '50%',
    right: undefined,
    width: 0.5,
    height: '100%',
  },
  point: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.7,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
