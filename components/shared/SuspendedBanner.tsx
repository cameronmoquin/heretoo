import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface SuspendedBannerProps {
  reason?: string;
}

export function SuspendedBanner({ reason }: SuspendedBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Suspended</Text>
      <Text style={styles.description}>
        Your account has been temporarily suspended.
        {reason ? ` Reason: ${reason}` : ''}
      </Text>
      <Text style={styles.appealText}>
        You can appeal this decision within 30 days. All appeals are reviewed by
        human moderators within 72 hours.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
  },
  description: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  appealText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
