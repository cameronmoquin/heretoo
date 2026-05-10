/**
 * FamilyTriviaPanel — players + question composer in one tab.
 *
 * Two modes:
 *   1. Play mode (default): a random question from the family's bank
 *      that the viewer hasn't answered today and didn't author. Tap
 *      a choice → reveal the right answer in gold + the explanation.
 *      "Next question" continues the round.
 *   2. Compose mode: add a new question to the bank. Question text,
 *      four answer choices, mark which is right, optional explanation.
 *
 * No leaderboard. The viewer's own "X of Y right" line shows in the
 * sub-bar — visible only to them. The spec refuses cross-family or
 * cross-user comparison.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useNextTriviaQuestion, useTriviaScore, useAddTriviaQuestion, useAnswerTrivia,
  useFamilyTriviaBank, useRetireTriviaQuestion,
} from '../../hooks/useTrivia';
import { showAlert } from '../../lib/alert';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  familyId: string;
}

type Mode = 'play' | 'compose' | 'manage';

export function FamilyTriviaPanel({ familyId }: Props) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const [mode, setMode] = useState<Mode>('play');
  const { data: score } = useTriviaScore(familyId);

  return (
    <View style={s.wrap}>
      <View style={s.subbar}>
        <View style={s.scoreCol}>
          {score && score.total_count > 0 ? (
            <>
              <Text style={s.scoreNum}>{score.correct_count} / {score.total_count}</Text>
              <Text style={s.scoreLabel}>your answers in this family</Text>
            </>
          ) : (
            <Text style={s.scoreLabel}>No answers yet — play a question.</Text>
          )}
        </View>
        <View style={s.tabRow}>
          {(['play', 'compose', 'manage'] as Mode[]).map((m) => {
            const on = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[s.tabBtn, on && s.tabBtnOn]}
                activeOpacity={0.75}
              >
                <Text style={[s.tabBtnText, on && s.tabBtnTextOn]}>
                  {m === 'play' ? 'Play' : m === 'compose' ? 'Add' : 'Yours'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {mode === 'play' && <PlayPane familyId={familyId} />}
      {mode === 'compose' && <ComposePane familyId={familyId} onDone={() => setMode('play')} />}
      {mode === 'manage' && <ManagePane familyId={familyId} userId={userId ?? null} />}
    </View>
  );
}

// ── Play ────────────────────────────────────────────────────────────

function PlayPane({ familyId }: { familyId: string }) {
  const s = makeStyles();
  const { data: q, isLoading, refetch } = useNextTriviaQuestion(familyId);
  const answer = useAnswerTrivia();
  const [submittedIdx, setSubmittedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correctIndex: number; explanation: string | null;
  } | null>(null);

  const onChoose = async (idx: 0 | 1 | 2 | 3) => {
    if (!q || submittedIdx !== null) return;
    setSubmittedIdx(idx);
    try {
      const r = await answer.mutateAsync({ questionId: q.id, chosenIndex: idx });
      setResult({ correctIndex: r.correctIndex, explanation: r.explanation });
    } catch (e: any) {
      showAlert('Could not submit', e?.message ?? 'Try again.');
      setSubmittedIdx(null);
    }
  };

  const onNext = () => {
    setSubmittedIdx(null);
    setResult(null);
    refetch();
  };

  if (isLoading) {
    return <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />;
  }
  if (!q) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>The bank is empty.</Text>
        <Text style={s.emptyBody}>
          Be the first to add a question. Trivia is just a fun way to ask the
          family what they remember about each other.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.playWrap}>
      <Text style={s.kicker}>
        From {q.author_name ?? q.author_handle ?? 'a family member'}
      </Text>
      <Text style={s.question}>{q.question}</Text>
      <View style={s.choices}>
        {q.choices.map((c, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isSubmitted = submittedIdx !== null;
          const isMine = submittedIdx === idx;
          const isCorrect = result && result.correctIndex === idx;
          const isWrongMine = isMine && result && !isCorrect;
          return (
            <TouchableOpacity
              key={i}
              style={[
                s.choice,
                isCorrect && s.choiceCorrect,
                isWrongMine && s.choiceWrong,
                isSubmitted && !isCorrect && !isWrongMine && { opacity: 0.5 },
              ]}
              onPress={() => onChoose(idx)}
              disabled={isSubmitted}
              activeOpacity={0.75}
            >
              <Text style={[
                s.choiceText,
                isCorrect && { color: '#0A0A0F', fontWeight: '700' },
                isWrongMine && { color: Colors.brandIvory },
              ]}>
                {String.fromCharCode(65 + i)}.  {c}
              </Text>
              {isSubmitted && isCorrect && (
                <Ionicons name="checkmark" size={16} color="#0A0A0F" />
              )}
              {isWrongMine && (
                <Ionicons name="close" size={16} color={Colors.brandIvory} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {result && (
        <View style={s.resultBox}>
          {result.explanation ? (
            <Text style={s.resultBody}>{result.explanation}</Text>
          ) : (
            <Text style={s.resultBody}>
              {result.correctIndex === submittedIdx
                ? 'Right.' : 'Now you know.'}
            </Text>
          )}
          <TouchableOpacity onPress={onNext} style={s.nextBtn} activeOpacity={0.85}>
            <Text style={s.nextBtnText}>Next question</Text>
            <Ionicons name="arrow-forward" size={14} color="#0A0A0F" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Compose ─────────────────────────────────────────────────────────

function ComposePane({ familyId, onDone }: { familyId: string; onDone: () => void }) {
  const s = makeStyles();
  const add = useAddTriviaQuestion();
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState<0 | 1 | 2 | 3>(0);
  const [explanation, setExplanation] = useState('');

  const setChoice = (i: 0 | 1 | 2 | 3, v: string) => {
    setChoices((prev) => {
      const next = [...prev] as typeof prev;
      next[i] = v;
      return next;
    });
  };

  const onSave = async () => {
    if (question.trim().length < 4) {
      showAlert('Question too short', 'Write at least four characters.');
      return;
    }
    if (choices.some((c) => c.trim().length < 1)) {
      showAlert('Fill in all four choices', 'Every option needs an answer.');
      return;
    }
    try {
      await add.mutateAsync({
        familyId,
        question,
        choices: choices.map((c) => c.trim()) as [string, string, string, string],
        correctIndex,
        explanation: explanation.trim() || undefined,
      });
      setQuestion(''); setChoices(['', '', '', '']);
      setCorrectIndex(0); setExplanation('');
      onDone();
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={s.composeWrap}>
        <Text style={s.fieldLabel}>The question</Text>
        <TextInput
          style={s.input}
          value={question}
          onChangeText={setQuestion}
          placeholder='e.g., Who said "I told you the lasagna was burnt" at Easter 2019?'
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={400}
        />
        <Text style={s.fieldLabel}>Four answers</Text>
        <Text style={s.hint}>
          Tap the small circle next to the right one to mark it.
        </Text>
        {choices.map((c, i) => {
          const idx = i as 0 | 1 | 2 | 3;
          const isCorrect = correctIndex === idx;
          return (
            <View key={i} style={s.choiceRow}>
              <TouchableOpacity
                style={[s.markCorrect, isCorrect && s.markCorrectOn]}
                onPress={() => setCorrectIndex(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isCorrect && <Ionicons name="checkmark" size={11} color="#0A0A0F" />}
              </TouchableOpacity>
              <Text style={s.choiceLetter}>{String.fromCharCode(65 + i)}</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={c}
                onChangeText={(v) => setChoice(idx, v)}
                placeholder={`Answer ${String.fromCharCode(65 + i)}`}
                placeholderTextColor={Colors.textMuted}
                maxLength={200}
              />
            </View>
          );
        })}

        <Text style={s.fieldLabel}>Explanation (optional)</Text>
        <TextInput
          style={s.input}
          value={explanation}
          onChangeText={setExplanation}
          placeholder="What's the story behind the right answer?"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={800}
        />

        <TouchableOpacity
          style={[s.saveBtn, add.isPending && { opacity: 0.5 }]}
          onPress={onSave}
          disabled={add.isPending}
          activeOpacity={0.85}
        >
          {add.isPending ? (
            <ActivityIndicator color="#0A0A0F" />
          ) : (
            <>
              <Ionicons name="add" size={16} color="#0A0A0F" />
              <Text style={s.saveBtnText}>Add to the bank</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Manage (your own questions) ─────────────────────────────────────

function ManagePane({ familyId, userId }: { familyId: string; userId: string | null }) {
  const s = makeStyles();
  const { data: bank } = useFamilyTriviaBank(familyId);
  const retire = useRetireTriviaQuestion();
  const mine = (bank ?? []).filter((q) => q.author_id === userId);

  if (mine.length === 0) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyTitle}>You haven&apos;t added any questions yet.</Text>
        <Text style={s.emptyBody}>Switch to Add and write one.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {mine.map((q) => (
        <View key={q.id} style={s.manageRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={s.manageQ} numberOfLines={2}>{q.question}</Text>
            <Text style={s.manageA}>
              ✓ {q.choices[q.correct_index]}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => retire.mutate(q.id)}
            style={s.retireBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="archive-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ── styles ─────────────────────────────────────────────────────────

function makeStyles() { return StyleSheet.create({
  wrap: { gap: Spacing.md, minHeight: 240 },

  subbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.5)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  scoreCol: { flex: 1, minWidth: 0 },
  scoreNum: {
    fontSize: 22, fontWeight: '800', color: Colors.brandIvory, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  scoreLabel: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  tabRow: { flexDirection: 'row', gap: 6 },
  tabBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtnOn: { borderColor: Colors.primary, backgroundColor: 'rgba(201,161,75,0.12)' },
  tabBtnText: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tabBtnTextOn: { color: Colors.primary },

  // Play
  playWrap: { gap: 14 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1.6,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  question: {
    fontSize: 22, lineHeight: 30, color: Colors.brandIvory, fontWeight: '500',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  choices: { gap: 8, marginTop: 4 },
  choice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'rgba(22, 22, 29, 0.6)',
  },
  choiceText: {
    fontSize: 15, color: Colors.textPrimary, fontWeight: '500',
    flex: 1, marginRight: 8,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  choiceCorrect: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceWrong: { backgroundColor: 'rgba(199, 62, 58, 0.32)', borderColor: '#C73E3A' },

  resultBox: {
    padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderLeftWidth: 2, borderLeftColor: Colors.primary, gap: 10,
  },
  resultBody: {
    fontSize: 14, lineHeight: 22, color: Colors.textPrimary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  nextBtnText: { color: '#0A0A0F', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  emptyWrap: { paddingVertical: Spacing.xl, gap: 6, alignItems: 'flex-start' },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  emptyBody: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  // Compose
  composeWrap: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6, marginTop: 8,
  },
  hint: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, minHeight: 38,
  },
  choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markCorrect: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  markCorrectOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  choiceLetter: {
    fontSize: 12, fontWeight: '700', color: Colors.primary, width: 14,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary, marginTop: Spacing.md,
  },
  saveBtnText: { color: '#0A0A0F', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  // Manage
  manageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  manageQ: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  manageA: { fontSize: 12, color: Colors.primary, fontStyle: 'italic' },
  retireBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
