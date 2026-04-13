import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Button } from '../shared/Button';
import { useInvite } from '../../hooks/useInvite';

export function InviteSection() {
  const { stats, isLoadingStats, sendInvite, isSharing } = useInvite();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bring people</Text>
        <Text style={styles.subtitle}>
          You know someone who belongs here.
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.totalSent}</Text>
          <Text style={styles.statLabel}>Invited</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{stats.totalAccepted}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: Colors.primary }]}>
            +{stats.totalAccepted * 2}%
          </Text>
          <Text style={styles.statLabel}>Trust Bonus</Text>
        </View>
      </View>

      <Button
        title="Invite"
        onPress={() => sendInvite.mutate()}
        loading={isSharing || sendInvite.isPending}
        variant="primary"
        size="lg"
        style={styles.button}
      />

      {stats.totalAccepted > 0 && (
        <Text style={styles.bonusNote}>
          Trust earned.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 14,
  },
  stat: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  divider: {
    width: 0.5,
    height: 28,
    backgroundColor: Colors.border,
  },
  button: {
    width: '100%',
  },
  bonusNote: {
    fontSize: 12,
    color: Colors.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
