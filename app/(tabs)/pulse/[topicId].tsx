import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  usePulseStatements,
  usePulseVote,
  usePulseRealtime,
  useSubmitStatement,
} from '../../../hooks/usePulse';
import { showAlert } from '../../../lib/alert';
import { usePulseStore, type VoteType } from '../../../stores/pulseStore';
import { OpinionSlider } from '../../../components/pulse/OpinionSlider';
import { ConsensusBar } from '../../../components/pulse/ConsensusBar';
import { ClusterMap } from '../../../components/pulse/ClusterMap';
import { Button } from '../../../components/shared/Button';
import { LoadingPulse } from '../../../components/shared/LoadingPulse';
import { Colors } from '../../../constants/colors';
import { generateMockClusterPoints } from '../../../lib/mock-data';

export default function TopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { data: statements, isLoading } = usePulseStatements(topicId);
  const vote = usePulseVote();
  const submitStatement = useSubmitStatement();
  const { activeVoterCount } = usePulseStore();
  const [newStatement, setNewStatement] = useState('');
  const [votedStatements, setVotedStatements] = useState<Set<string>>(new Set());

  // Subscribe to realtime
  usePulseRealtime(topicId);

  const handleVote = (statementId: string, voteType: VoteType) => {
    vote.mutate(
      { statementId, vote: voteType },
      {
        onSuccess: () => {
          setVotedStatements((prev) => new Set(prev).add(statementId));
        },
      }
    );
  };

  const handleSubmitStatement = () => {
    if (!newStatement.trim()) return;
    submitStatement.mutate(
      { topicId, text: newStatement.trim() },
      {
        onSuccess: () => {
          setNewStatement('');
          showAlert('Submitted', 'Live now.');
        },
      }
    );
  };

  // Find top bridging statement
  const topBridging = statements
    ?.slice()
    .sort((a, b) => b.bridging_score - a.bridging_score)[0];

  if (isLoading) return <LoadingPulse />;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Cluster Map */}
          <ClusterMap points={generateMockClusterPoints(50)} activeVoterCount={activeVoterCount} />

          {/* Top bridging statement */}
          {topBridging && topBridging.bridging_score > 0 && (
            <View style={styles.topBridging}>
              <Text style={styles.topBridgingLabel}>Common Ground</Text>
              <Text style={styles.topBridgingText}>{topBridging.text}</Text>
              <ConsensusBar bridgingScore={topBridging.bridging_score} />
            </View>
          )}

          {/* Statement cards */}
          <View style={styles.statementsSection}>
            <Text style={styles.sectionTitle}>
              {statements?.length ?? 0} statements
            </Text>
            {statements?.map((statement) => (
              <OpinionSlider
                key={statement.id}
                statement={statement}
                onVote={(voteType) => handleVote(statement.id, voteType)}
                hasVoted={votedStatements.has(statement.id)}
              />
            ))}
          </View>

          {/* Submit new statement */}
          <View style={styles.submitSection}>
            <Text style={styles.sectionTitle}>Say something</Text>
            <TextInput
              style={styles.input}
              placeholder="What do you think?"
              placeholderTextColor={Colors.textMuted}
              value={newStatement}
              onChangeText={setNewStatement}
              multiline
              maxLength={280}
            />
            <Button
              title="Submit"
              onPress={handleSubmitStatement}
              loading={submitStatement.isPending}
              disabled={!newStatement.trim()}
              size="md"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 24,
    paddingBottom: 100,
  },
  topBridging: {
    backgroundColor: 'rgba(232, 201, 122, 0.08)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.brandGold,
  },
  topBridgingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brandGold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topBridgingText: {
    fontSize: 16,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  statementsSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  submitSection: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
