import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  usePulseStatements,
  usePulseVote,
  usePulseRealtime,
  useSubmitStatement,
} from '../../../hooks/usePulse';
import { showAlert } from '../../../lib/alert';
import { usePulseStore, type VoteType } from '../../../stores/pulseStore';
import { Button } from '../../../components/shared/Button';
import { LoadingPulse } from '../../../components/shared/LoadingPulse';
import { Colors } from '../../../constants/colors';
import { Radius, Spacing } from '../../../constants/design';

export default function TopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { data: statements, isLoading } = usePulseStatements(topicId);
  const vote = usePulseVote();
  const submitStatement = useSubmitStatement();
  const { activeVoterCount } = usePulseStore();
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [newStatement, setNewStatement] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);

  usePulseRealtime(topicId);

  // Unvoted statements
  const unvoted = useMemo(
    () => (statements ?? []).filter((s) => !votedIds.has(s.id)),
    [statements, votedIds]
  );

  // Consensus statements — voted on and high bridging score
  const consensus = useMemo(
    () => (statements ?? [])
      .filter((s) => votedIds.has(s.id) && s.bridging_score > 0.7)
      .sort((a, b) => b.bridging_score - a.bridging_score),
    [statements, votedIds]
  );

  const currentCard = unvoted[0];
  const totalStatements = statements?.length ?? 0;
  const votedCount = votedIds.size;
  const progress = totalStatements > 0 ? votedCount / totalStatements : 0;
  const canSubmit = votedCount >= 3; // Must vote on 3 before submitting your own

  const handleVote = (voteType: VoteType) => {
    if (!currentCard) return;
    vote.mutate(
      { statementId: currentCard.id, vote: voteType },
      {
        onSuccess: () => {
          setVotedIds((prev) => new Set(prev).add(currentCard.id));
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
          setShowSubmit(false);
          showAlert('Submitted', 'Live now.');
        },
      }
    );
  };

  if (isLoading) return <LoadingPulse />;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.liveRow}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>{activeVoterCount} voting</Text>
          </View>
          <Text style={s.headerCount}>{votedCount} of {totalStatements}</Text>
        </View>
        {canSubmit && (
          <TouchableOpacity onPress={() => setShowSubmit(!showSubmit)} style={s.addBtn}>
            <Ionicons name="add" size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Submit your own */}
        {showSubmit && (
          <View style={s.submitArea}>
            <Text style={s.submitTitle}>Add a statement</Text>
            <TextInput
              style={s.submitInput}
              placeholder="What do you think?"
              placeholderTextColor={Colors.textMuted}
              value={newStatement}
              onChangeText={setNewStatement}
              multiline
              maxLength={280}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={handleSubmitStatement}
            />
            <View style={s.submitActions}>
              <Text style={s.charCount}>{newStatement.length}/280</Text>
              <Button title="Submit" onPress={handleSubmitStatement} loading={submitStatement.isPending} disabled={!newStatement.trim()} size="sm" />
            </View>
          </View>
        )}

        {/* Voting card */}
        {currentCard && !showSubmit && (
          <View style={s.cardArea}>
            <View style={s.card}>
              <Text style={s.cardText}>{currentCard.text}</Text>
            </View>

            {/* Vote buttons */}
            <View style={s.voteRow}>
              <TouchableOpacity style={[s.voteBtn, s.voteBtnDisagree]} onPress={() => handleVote('disagree')} activeOpacity={0.7}>
                <Ionicons name="close" size={28} color={Colors.disagree} />
                <Text style={[s.voteBtnLabel, { color: Colors.disagree }]}>Disagree</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.voteBtn, s.voteBtnPass]} onPress={() => handleVote('pass')} activeOpacity={0.7}>
                <Ionicons name="remove" size={28} color={Colors.textMuted} />
                <Text style={[s.voteBtnLabel, { color: Colors.textMuted }]}>Pass</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.voteBtn, s.voteBtnAgree]} onPress={() => handleVote('agree')} activeOpacity={0.7}>
                <Ionicons name="checkmark" size={28} color={Colors.agree} />
                <Text style={[s.voteBtnLabel, { color: Colors.agree }]}>Agree</Text>
              </TouchableOpacity>
            </View>

            {!canSubmit && (
              <Text style={s.hintText}>Vote on {3 - votedCount} more to add your own</Text>
            )}
          </View>
        )}

        {/* Done voting — show consensus */}
        {!currentCard && !showSubmit && (
          <View style={s.doneArea}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.agree} />
            <Text style={s.doneTitle}>All voted.</Text>
            <Text style={s.doneSub}>{votedCount} statements. Here is where people agree.</Text>

            {consensus.length > 0 && (
              <View style={s.consensusList}>
                <Text style={s.consensusLabel}>Common Ground</Text>
                {consensus.map((stmt) => {
                  const total = stmt.agree_count + stmt.disagree_count + stmt.pass_count;
                  const pct = total > 0 ? Math.round((stmt.agree_count / total) * 100) : 0;
                  return (
                    <View key={stmt.id} style={s.consensusCard}>
                      <Text style={s.consensusText}>{stmt.text}</Text>
                      <View style={s.consensusBar}>
                        <View style={[s.consensusFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={s.consensusPct}>{pct}% agree</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {canSubmit && (
              <Button title="Add your own" onPress={() => setShowSubmit(true)} variant="outline" size="md" style={{ marginTop: 16 }} />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.agree },
  liveText: { fontSize: 12, fontWeight: '500', color: Colors.agree },
  headerCount: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  addBtn: { padding: 4 },

  progressBar: { height: 2, backgroundColor: Colors.border },
  progressFill: { height: 2, backgroundColor: Colors.primary },

  // Card
  cardArea: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: 32, width: '100%', maxWidth: 420,
    minHeight: 160, justifyContent: 'center', marginBottom: 32,
  },
  cardText: { fontSize: 18, fontWeight: '500', color: Colors.textPrimary, lineHeight: 28, textAlign: 'center' },

  voteRow: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  voteBtn: {
    width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, gap: 4,
  },
  voteBtnDisagree: { borderColor: Colors.disagree + '40' },
  voteBtnPass: { borderColor: Colors.border },
  voteBtnAgree: { borderColor: Colors.agree + '40' },
  voteBtnLabel: { fontSize: 10, fontWeight: '600' },

  hintText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 20 },

  // Submit
  submitArea: { padding: 20, gap: 12 },
  submitTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  submitInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top',
  },
  submitActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, color: Colors.textMuted },

  // Done
  doneArea: { flex: 1, alignItems: 'center', padding: 32, gap: 8, paddingTop: 60 },
  doneTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  doneSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  consensusList: { width: '100%', gap: 10, marginTop: 20 },
  consensusLabel: { fontSize: 13, fontWeight: '700', color: Colors.agree, textTransform: 'uppercase', letterSpacing: 1 },
  consensusCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  consensusText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  consensusBar: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  consensusFill: { height: 4, backgroundColor: Colors.agree, borderRadius: 2 },
  consensusPct: { fontSize: 12, color: Colors.textMuted },
});
