import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Button } from './Button';
import { useVerification } from '../../hooks/useVerification';

interface VerificationGateProps {
  children: React.ReactNode;
  action: 'create_post' | 'send_bridge_message' | 'send_invite' | 'create_statement';
  fallbackMessage?: string;
}

/**
 * Wraps content that requires human verification.
 * Shows a verification prompt if the user hasn't met the threshold.
 */
export function VerificationGate({
  children,
  action,
  fallbackMessage,
}: VerificationGateProps) {
  const { isVerified, votesUntilVerified, pulseVotesCount, canDo } =
    useVerification();

  if (canDo(action)) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.lockIcon}>
        <Text style={styles.lockEmoji}>🔒</Text>
      </View>

      <Text style={styles.title}>Prove you're real</Text>

      <Text style={styles.description}>
        {fallbackMessage ??
          'Participate first. Then post.'}
      </Text>

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (pulseVotesCount / 5) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {votesUntilVerified > 0
            ? `Vote on ${votesUntilVerified} more Pulse statement${votesUntilVerified === 1 ? '' : 's'} to unlock`
            : 'Almost there!'}
        </Text>
      </View>

      <Button
        title="Pulse"
        onPress={() => router.push('/(tabs)/pulse')}
        variant="primary"
        size="lg"
        style={styles.button}
      />

      <Text style={styles.altText}>
        Or verify by phone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.background,
    gap: 16,
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockEmoji: {
    fontSize: 28,
  },
  title: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  progressSection: {
    width: '100%',
    gap: 8,
    marginVertical: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    marginTop: 8,
  },
  altText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
