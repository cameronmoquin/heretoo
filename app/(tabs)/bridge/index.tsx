import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  useBridgeSessions,
  useFindBridgeMatch,
  useRespondToMatch,
} from '../../../hooks/useBridge';
import { MatchCard } from '../../../components/bridge/MatchCard';
import { Button } from '../../../components/shared/Button';
import { Colors } from '../../../constants/colors';

export default function BridgeHomeScreen() {
  const { data: sessions, isLoading } = useBridgeSessions();
  const findMatch = useFindBridgeMatch();
  const respondToMatch = useRespondToMatch();

  const pendingSessions = sessions?.filter((s) => s.status === 'pending') ?? [];
  const activeSessions = sessions?.filter((s) => s.status === 'active') ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>The Bridge</Text>
          <Text style={styles.subtitle}>
            Your next real conversation is out there.
          </Text>
        </View>

        {/* Find a match button */}
        <Button
          title="Show up"
          onPress={() => findMatch.mutate()}
          loading={findMatch.isPending}
          size="lg"
          style={styles.findButton}
        />

        {/* Pending matches */}
        {pendingSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waiting</Text>
            {pendingSessions.map((session) => (
              <MatchCard
                key={session.id}
                session={session}
                onAccept={() =>
                  respondToMatch.mutate({ sessionId: session.id, accept: true })
                }
                onDecline={() =>
                  respondToMatch.mutate({ sessionId: session.id, accept: false })
                }
              />
            ))}
          </View>
        )}

        {/* Active conversations */}
        {activeSessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Open</Text>
            {activeSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => router.push(`/(tabs)/bridge/${session.id}`)}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionPartner}>
                    {session.partner?.display_name ?? 'Bridge Partner'}
                  </Text>
                  <Text style={styles.sessionTopic}>
                    {session.topic?.title}
                  </Text>
                </View>
                <Text style={styles.sessionHint}>
                  48 hours. Be real.
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isLoading &&
          pendingSessions.length === 0 &&
          activeSessions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your match is out there.</Text>
              <Text style={styles.emptyText}>
                Vote on a topic first.
              </Text>
            </View>
          )}

        {isLoading && (
          <ActivityIndicator
            color={Colors.primary}
            size="large"
            style={{ marginTop: 40 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontWeight: '800',
    fontSize: 28,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  findButton: {
    width: '100%',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 8,
  },
  sessionHeader: {
    gap: 4,
  },
  sessionPartner: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sessionTopic: {
    fontSize: 13,
    color: Colors.bridge,
    fontWeight: '500',
  },
  sessionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
