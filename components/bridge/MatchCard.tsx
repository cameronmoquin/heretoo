import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { CLUSTER_BY_ID } from '../../constants/clusters';
import { Button } from '../shared/Button';
import type { BridgeSession } from '../../hooks/useBridge';

interface MatchCardProps {
  session: BridgeSession;
  onAccept: () => void;
  onDecline: () => void;
}

export function MatchCard({ session, onAccept, onDecline }: MatchCardProps) {
  const partnerCluster = session.partner?.cluster_id
    ? CLUSTER_BY_ID[session.partner.cluster_id]
    : null;

  const currentYear = new Date().getFullYear();
  const partnerAge = session.partner?.birth_year
    ? currentYear - session.partner.birth_year
    : null;

  const generationLabel = partnerAge
    ? partnerAge < 25
      ? 'Gen Z'
      : partnerAge < 40
      ? 'Millennial'
      : partnerAge < 55
      ? 'Gen X'
      : 'Boomer+'
    : 'Unknown';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Bridge Match Found</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{generationLabel}</Text>
          <Text style={styles.statLabel}>Generation</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <View
            style={[
              styles.clusterDot,
              { backgroundColor: partnerCluster?.displayColor ?? Colors.textMuted },
            ]}
          />
          <Text style={styles.statLabel}>
            {partnerCluster?.description ?? 'Unknown'} cluster
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Math.round(session.match_score * 100)}%
          </Text>
          <Text style={styles.statLabel}>Match</Text>
        </View>
      </View>

      {session.topic && (
        <View style={styles.topicRow}>
          <Text style={styles.topicLabel}>Shared topic:</Text>
          <Text style={styles.topicText}>{session.topic.title}</Text>
        </View>
      )}

      <Text style={styles.note}>
        Names and photos are hidden until both sides accept.
      </Text>

      <View style={styles.buttons}>
        <Button title="Pass" onPress={onDecline} variant="ghost" style={{ flex: 1 }} />
        <Button title="Accept Match" onPress={onAccept} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.bridge,
  },
  label: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 20,
    color: Colors.bridge,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  clusterDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  divider: {
    width: 0.5,
    height: 32,
    backgroundColor: Colors.border,
  },
  topicRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  topicLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  topicText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  note: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
});
