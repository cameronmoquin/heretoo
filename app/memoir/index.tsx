/**
 * /memoir — the single-prompt interview surface (Milestone 13).
 *
 * One prompt at a time. Centered, large, serif on serif skins. The user
 * answers, the answer commits, and Claude (Socratic mode) picks the
 * next follow-up. The page deliberately has no progress bar and no
 * "47 of 300" counter; the interview is a conversation, not a quest.
 *
 * "Save and step away" ends the session and returns to the Room.
 * "Past entries" flips the page to the library view.
 *
 * Skin lives in the token engine now: color from Colors, size from
 * Type (scaled by the reading-size knob), font and corner from Gen.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useEnsureMemoirProject,
  useMemoirProject,
  useNextMemoirPrompt,
  useMemoirResponses,
  useSaveMemoirResponse,
  useStartMemoirSession,
  useEndMemoirSession,
  useMemoirInterviewTurn,
  useMemoirTranscribe,
  useMemoirGrammarCheck,
  useResolveCowriterDraft,
  useUpdateMemoirResponse,
  useDeleteMemoirResponse,
  type MemoirPrompt, type MemoirResponse, type CleanupResult,
} from '../../hooks/useMemoir';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { useTTS } from '../../stores/ttsStore';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Type, FontFamily, Radius } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { RailCard } from '../../components/shared/RailCard';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { ReadingSizeAction } from '../../components/memoir/ReadingSizeAction';

/** A prompt-and-its-tree the interview is currently sitting on.
 *  Either a library prompt (the user just landed on it) or a
 *  Claude-generated follow-up (custom text, no library id). */
interface ActivePrompt {
  question: string;
  promptId: string | null;
  customText: string | null;
  followUps: Array<{ question: string; condition_hint?: string }>;
  triggers_warning: boolean;
  chapter_or_thread: string | null;
}

function fromLibrary(p: MemoirPrompt): ActivePrompt {
  return {
    question: p.primary_question,
    promptId: p.id,
    customText: null,
    followUps: p.follow_ups ?? [],
    triggers_warning: !!p.triggers_warning,
    chapter_or_thread: p.chapter_or_thread,
  };
}

export default function MemoirScreen() {
  const reading = useMemoirReadingMode();
  const { scale, large } = reading;
  const s = makeStyles(scale);
  const { data: projectId } = useEnsureMemoirProject();
  const { data: project } = useMemoirProject(projectId);
  const { data: nextPrompt, refetch: refetchNext, isFetching: isPicking } =
    useNextMemoirPrompt(projectId);
  const { data: responses } = useMemoirResponses(projectId);
  const save = useSaveMemoirResponse();
  const startSession = useStartMemoirSession();
  const endSession = useEndMemoirSession();
  const interview = useMemoirInterviewTurn();
  const transcribe = useMemoirTranscribe();
  const voice = useVoiceRecorder();
  const tts = useTTS();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [active, setActive] = useState<ActivePrompt | null>(null);
  const [answer, setAnswer] = useState('');
  const [turns, setTurns] = useState(0);
  const [view, setView] = useState<'interview' | 'library'>('interview');
  // The "More" shelf under the room nav. Collapsed by default — the
  // point of moving Babybook here was to stop it competing for
  // attention, so opening on it would undo the move.
  const [moreOpen, setMoreOpen] = useState(false);
  const [warningAck, setWarningAck] = useState<Record<string, boolean>>({});
  // Terminal state: the session has wound down. Holds the closing
  // summary paragraph. The composer is hidden; the user reads the
  // recap and either steps away or starts a fresh session.
  const [ended, setEnded] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(1)).current;

  // Running log of this session's exchanges, so each follow-up is
  // generated with awareness of what was already said. Kept in a ref
  // (not state) since it never needs to trigger a re-render; we read
  // it synchronously when building the next turn's context.
  const sessionLog = useRef<Array<{ q: string; a: string }>>([]);

  // Build a compact recap of the last few turns for the interview API.
  // We cap it so the prompt stays small (the spec's sliding window).
  const buildRecentContext = () => {
    const recent = sessionLog.current.slice(-5);
    if (recent.length === 0) return '';
    return recent
      .map((t, i) => `(${i + 1}) Q: ${t.q}\n    A: ${t.a}`)
      .join('\n');
  };

  // Start a session on first project load.
  useEffect(() => {
    if (!projectId || sessionId) return;
    startSession.mutateAsync({
      projectId,
      guidanceMode: project?.guidance_mode ?? 'socratic',
    }).then(setSessionId).catch(() => {});
  }, [projectId, sessionId, project?.guidance_mode]);

  // Bind the active prompt to the freshly picked library prompt
  // whenever we don't already have one (start of session, or after
  // a save that requested a new library prompt).
  useEffect(() => {
    if (!active && nextPrompt) setActive(fromLibrary(nextPrompt));
  }, [nextPrompt, active]);

  const ttsId = active ? `memoir-q-${active.promptId ?? 'custom'}-${turns}` : '';
  const ttsActive = !!active && tts.currentId === ttsId && tts.playing;

  const onReadAloud = () => {
    if (active) tts.toggle(ttsId, active.question);
  };

  // Voice answer: record → transcribe → drop the text into the
  // composer for the writer to review and edit (never auto-commits).
  const onMicPress = async () => {
    if (transcribe.isPending) return;
    if (!voice.recording) {
      await voice.start();
      return;
    }
    const audio = await voice.stop();
    if (!audio) return;
    try {
      const text = await transcribe.mutateAsync(audio);
      if (text) {
        setAnswer((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      }
    } catch (e: any) {
      showAlert(
        'Could not transcribe',
        e?.message?.includes('not set up')
          ? 'Voice typing is not turned on yet. You can type your answer for now.'
          : (e?.message ?? 'Try again, or type your answer.'),
      );
    }
  };

  const crossfade = (to: () => void) => {
    Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true })
      .start(() => {
        to();
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
  };

  const onSubmitAnswer = async () => {
    if (!active || !sessionId || !projectId) return;
    const trimmed = answer.trim();
    if (trimmed.length < 4) {
      showAlert('Write a little more', 'Even one or two sentences are enough.');
      return;
    }
    try {
      // 1. Commit the response.
      await save.mutateAsync({
        sessionId,
        projectId,
        promptId: active.promptId,
        customPromptText: active.customText,
        transcript: trimmed,
        finalText: trimmed,
        chapterAssignment: active.chapter_or_thread,
      });
      // 2. Ask Claude for the next follow-up (Socratic), giving it the
      //    running session recap so the follow-up builds on earlier
      //    answers instead of treating each turn as isolated.
      const turn = await interview.mutateAsync({
        primaryQuestion: active.question,
        followUps: active.followUps,
        userAnswer: trimmed,
        turnsSoFar: turns + 1,
        recentContext: buildRecentContext(),
      });
      // Record this exchange now that it's committed.
      sessionLog.current.push({ q: active.question, a: trimmed });
      setTurns((n) => n + 1);
      setAnswer('');
      // 3. Decide what to show next.
      if (!turn.session_continue) {
        // End the session warmly.
        try {
          await endSession.mutateAsync({
            sessionId,
            summary: turn.session_summary || 'A good stretch of writing.',
            nextHint: '',
          });
        } catch {}
        crossfade(() => {
          setActive(null);
          setEnded(turn.session_summary || 'A good stretch of writing. Step away when you like.');
        });
        return;
      }
      // 4. Otherwise: install Claude's follow-up as the next active prompt.
      //    If Claude indicated the answer feels exhausted on this prompt
      //    (no follow-up generated), pull a fresh library prompt instead.
      if (turn.next_question && turn.next_question.toLowerCase() !== 'tell me more about that.') {
        crossfade(() => {
          setActive({
            question: turn.next_question,
            promptId: null,
            customText: turn.next_question,
            followUps: [], // Claude generates its own next move from the conversation
            triggers_warning: false,
            chapter_or_thread: active.chapter_or_thread,
          });
        });
      } else {
        // Fall back to a fresh library prompt.
        const { data: fresh } = await refetchNext();
        crossfade(() => setActive(fresh ? fromLibrary(fresh) : null));
      }
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onSkipPrompt = async () => {
    // Don't save anything. Just pull a fresh library prompt.
    setAnswer('');
    const { data: fresh } = await refetchNext();
    crossfade(() => setActive(fresh ? fromLibrary(fresh) : null));
  };

  const onSaveAndStepAway = async () => {
    if (sessionId) {
      try {
        await endSession.mutateAsync({
          sessionId,
          summary: turns > 0
            ? `You wrote ${turns} ${turns === 1 ? 'answer' : 'answers'} today.`
            : '',
          nextHint: active?.chapter_or_thread ?? '',
        });
      } catch {}
    }
    router.back();
  };

  // Begin a fresh session after the previous one wound down.
  const onStartAnother = async () => {
    if (!projectId) return;
    setEnded(null);
    sessionLog.current = [];
    setTurns(0);
    try {
      const newSession = await startSession.mutateAsync({
        projectId,
        guidanceMode: project?.guidance_mode ?? 'socratic',
      });
      setSessionId(newSession);
    } catch {}
    const { data: fresh } = await refetchNext();
    crossfade(() => setActive(fresh ? fromLibrary(fresh) : null));
  };

  const showWarning = !!active?.triggers_warning
    && !warningAck[active.question];

  // ─── Render ─────────────────────────────────────────────────────

  if (view === 'library') {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ScreenHeader
          title="Past entries"
          showBack
          onBack={() => setView('interview')}
          backLabel="Back to writing"
          right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
        />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.list}>
            {(responses ?? []).length === 0 ? (
              <Text style={s.empty}>Nothing saved yet.</Text>
            ) : (
              (responses ?? []).map((r) => <LibraryRow key={r.id} response={r} scale={scale} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader
        title={project?.title ?? 'Memoir'}
        showBack
        onBack={onSaveAndStepAway}
        backLabel="Save and step away"
        right={<ReadingSizeAction large={large} onToggle={reading.toggle} />}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Room nav. */}
        <View style={s.nav}>
          <Button
            title="Timeline"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/timeline')}
            icon={<Ionicons name="git-commit-outline" size={14} color={Colors.primary} />}
          />
          <Button
            title="Import a resume or transcript"
            variant="outline"
            size="sm"
            onPress={() => router.push('/memoir/import')}
            icon={<Ionicons name="document-attach-outline" size={14} color={Colors.primary} />}
          />
          {(responses ?? []).length > 0 && (
            <>
              <Button
                title="Past entries"
                variant="outline"
                size="sm"
                onPress={() => setView('library')}
                icon={<Ionicons name="library-outline" size={14} color={Colors.primary} />}
              />
              <Button
                title="Make the book"
                variant="outline"
                size="sm"
                onPress={() => router.push('/memoir/book')}
                icon={<Ionicons name="book-outline" size={14} color={Colors.primary} />}
              />
            </>
          )}
          {/* More. Babybook lives under here rather than in the room
              list: it is a memoir of someone else's first years, not a
              room of its own, and it was competing for a top-level slot
              with the rooms people actually open. Everything filed here
              is a memoir that is not YOUR memoir. */}
          <Button
            title={moreOpen ? 'Less' : 'More'}
            variant="ghost"
            size="sm"
            onPress={() => setMoreOpen((v) => !v)}
            icon={
              <Ionicons
                name={moreOpen ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
                size={14}
                color={Colors.textSecondary}
              />
            }
          />
        </View>

        {moreOpen && (
          <View style={s.nav}>
            <Button
              title="Babybook"
              variant="outline"
              size="sm"
              onPress={() => router.push('/babybook')}
              icon={<Ionicons name="happy-outline" size={14} color={Colors.primary} />}
            />
          </View>
        )}

        {/* Terminal state — the session wound down. Read the recap,
            then step away or begin again. No composer here. */}
        {ended ? (
          <RailCard eyebrow="That's a good place to stop" style={s.stageCard}>
            <Text style={s.endSummary}>{ended}</Text>
            <View style={s.actions}>
              <Button
                title="Keep going"
                onPress={onStartAnother}
                icon={<Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />}
              />
              <Button title="Step away" variant="ghost" onPress={() => router.back()} />
            </View>
          </RailCard>
        ) : !active ? (
          isPicking
            ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
            : <Text style={s.allDone}>You&apos;ve answered every prompt.</Text>
        ) : (
          <Animated.View style={{ opacity: fade }}>
            {/* Content-warning card */}
            {showWarning && (
              <RailCard accentColor={Colors.error} eyebrow="This one may be tender" style={s.stageCard}>
                <Text style={s.warnBody}>
                  The next question touches a hard subject. Answer it if you want, skip if you&apos;d
                  rather. Both are right.
                </Text>
                <View style={s.actions}>
                  <Button
                    title="Show the question"
                    onPress={() => setWarningAck((prev) => ({ ...prev, [active.question]: true }))}
                  />
                  <Button title="Skip this one" variant="outline" onPress={onSkipPrompt} />
                </View>
              </RailCard>
            )}

            {!showWarning && (
              <View style={s.stage}>
                <View style={s.stageRule} pointerEvents="none" />
                <Text style={s.question}>{active.question}</Text>
                <View style={s.questionActions}>
                  <TouchableOpacity onPress={onReadAloud} style={s.readBtn} activeOpacity={0.85} accessibilityLabel={ttsActive ? 'Pause' : 'Hear it read'}>
                    <Ionicons
                      name={ttsActive ? 'pause' : 'volume-medium-outline'}
                      size={14}
                      color={Colors.primary}
                    />
                    <Text style={s.readBtnText}>{ttsActive ? 'Pause' : 'Hear it read'}</Text>
                  </TouchableOpacity>
                  {active.promptId && (
                    <TouchableOpacity onPress={onSkipPrompt} style={s.skipBtn} activeOpacity={0.85} accessibilityLabel="Skip this one">
                      <Text style={s.skipBtnText}>Skip this one</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Voice answer — web only. Keyboard stays available. */}
                {voice.isSupported && (
                  <View style={s.micRow}>
                    <TouchableOpacity
                      style={[s.micBtn, voice.recording && s.micBtnRec]}
                      onPress={onMicPress}
                      disabled={transcribe.isPending}
                      activeOpacity={0.85}
                      accessibilityLabel={voice.recording ? 'Stop recording' : 'Speak your answer'}
                    >
                      {transcribe.isPending ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <Ionicons
                          name={voice.recording ? 'stop' : 'mic-outline'}
                          size={18}
                          color={voice.recording ? '#fff' : Colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                    {(transcribe.isPending || voice.recording) && (
                      <Text style={s.micHint}>
                        {transcribe.isPending ? 'Writing down what you said…' : 'Listening…'}
                      </Text>
                    )}
                  </View>
                )}

                {/* Composer */}
                <TextInput
                  style={s.input}
                  value={answer}
                  onChangeText={setAnswer}
                  accessibilityLabel="Your answer"
                  multiline
                  maxLength={8000}
                  textAlignVertical="top"
                />

                <View style={s.actions}>
                  <Button
                    title="Save and continue"
                    onPress={onSubmitAnswer}
                    loading={save.isPending || interview.isPending}
                    disabled={answer.trim().length < 4}
                    icon={<Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />}
                  />
                  <Button title="Save and step away" variant="ghost" onPress={onSaveAndStepAway} />
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Library row (past entries) ─────────────────────────────────────

function LibraryRow({ response, scale }: { response: MemoirResponse; scale: number }) {
  const s = makeStyles(scale);
  const iconColor = Colors.textSecondary;
  const tts = useTTS();
  const cleanup = useMemoirGrammarCheck();
  const resolve = useResolveCowriterDraft();
  const update = useUpdateMemoirResponse();
  const del = useDeleteMemoirResponse();
  const id = `memoir-r-${response.id}`;
  const ttsActive = tts.currentId === id && tts.playing;
  const date = new Date(response.created_at).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const q = response.prompt?.primary_question ?? response.custom_prompt_text ?? '';

  // Clean-up state: the result of the grammar pass. `edits` are
  // mechanical fixes the writer can apply; `suggestions` are advice the
  // writer acts on themselves. The AI never rewrites the prose.
  const [result, setResult] = useState<CleanupResult | null>(null);

  // Edit state: the prose opens into a text field, seeded from the
  // current final_text each time editing begins.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(response.final_text);

  const onSaveEdit = async () => {
    const text = draft.trim();
    if (!text) {
      showAlert('Write a little more', 'Even one or two sentences are enough.');
      return;
    }
    try {
      await update.mutateAsync({
        id: response.id,
        projectId: response.project_id,
        patch: { final_text: text },
      });
      setEditing(false);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onDelete = () => {
    showConfirm(
      'Delete this entry?',
      'This cannot be undone.',
      () => {
        del.mutate(
          { id: response.id, projectId: response.project_id },
          { onError: (e: any) => showAlert('Could not delete', e?.message ?? 'Try again.') },
        );
      },
      'Delete',
    );
  };

  const onCleanUp = async () => {
    try {
      const r = await cleanup.mutateAsync({ text: response.final_text, responseId: response.id });
      if (r.edits.length === 0 && r.suggestions.length === 0) {
        showAlert('Looks clean', 'No fixes, no notes. Your words stand as they are.');
        return;
      }
      setResult(r);
    } catch (e: any) {
      showAlert('Could not check', e?.message?.includes('not configured')
        ? 'The editor is not turned on yet.'
        : (e?.message ?? 'Try again.'));
    }
  };

  // Apply only the mechanical fixes to the saved text. Suggestions are
  // never applied automatically.
  const applyFixes = () => {
    if (!result) return;
    let text = response.final_text;
    for (const e of result.edits) {
      const i = text.indexOf(e.original);
      if (i >= 0) text = text.slice(0, i) + e.suggested + text.slice(i + e.original.length);
    }
    resolve.mutate({
      responseId: response.id,
      projectId: response.project_id,
      draft: '', choice: 'edit_draft', finalText: text,
    });
    setResult(null);
  };

  return (
    <RailCard eyebrow={date}>
      {!!q && <Text style={s.libQuestion}>{q}</Text>}
      {editing ? (
        <>
          <TextInput
            style={s.draftInput}
            value={draft}
            onChangeText={setDraft}
            accessibilityLabel="Edit entry text"
            multiline
            maxLength={8000}
            textAlignVertical="top"
          />
          <View style={s.draftActions}>
            <Button title="Save" onPress={onSaveEdit} loading={update.isPending} />
            <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} />
          </View>
        </>
      ) : (
        <>
          <Text style={s.libBody}>{response.final_text}</Text>
          <View style={s.libActions}>
            <TouchableOpacity
              onPress={() => tts.toggle(id, response.final_text)}
              style={s.libAction}
              accessibilityLabel="Read this entry aloud"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={ttsActive ? 'pause' : 'volume-medium-outline'} size={14} color={iconColor} />
              <Text style={s.libActionText}>{ttsActive ? 'Pause' : 'Read aloud'}</Text>
            </TouchableOpacity>
            {!result && (
              <TouchableOpacity
                onPress={onCleanUp}
                style={s.libAction}
                disabled={cleanup.isPending}
                accessibilityLabel="Check this entry for typos"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {cleanup.isPending ? (
                  <ActivityIndicator size="small" color={iconColor} />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={14} color={iconColor} />
                    <Text style={s.libActionText}>Clean up</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { setDraft(response.final_text); setEditing(true); }}
              style={s.libAction}
              accessibilityLabel="Edit this entry"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={14} color={iconColor} />
              <Text style={s.libActionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDelete}
              style={s.libAction}
              accessibilityLabel="Delete this entry"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={14} color={iconColor} />
              <Text style={s.libActionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Clean-up drawer: mechanical fixes to apply, ideas to consider.
          The AI never rewrites the prose. */}
      {result && (
        <View style={s.draftCard}>
          {result.edits.length > 0 ? (
            <>
              <Eyebrow accentColor={Colors.primary}>Fixes ({result.edits.length})</Eyebrow>
              {result.edits.map((e, i) => (
                <Text key={`f${i}`} style={s.fixLine}>
                  “{e.original}” → “{e.suggested}”{e.reason ? `  (${e.reason})` : ''}
                </Text>
              ))}
            </>
          ) : (
            <Eyebrow accentColor={Colors.primary}>No grammar fixes needed</Eyebrow>
          )}

          {result.suggestions.length > 0 && (
            <>
              <Eyebrow accentColor={Colors.primary} style={{ marginTop: 10 }}>Ideas to consider</Eyebrow>
              {result.suggestions.map((sug, i) => (
                <Text key={`s${i}`} style={s.suggestLine}>• {sug}</Text>
              ))}
            </>
          )}

          <View style={s.draftActions}>
            {result.edits.length > 0 && (
              <Button title="Apply fixes" size="sm" onPress={applyFixes} />
            )}
            <Button title="Done" variant="ghost" size="sm" onPress={() => setResult(null)} />
          </View>
        </View>
      )}
    </RailCard>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
//
// One palette, driven by the skin engine. `scale` multiplies the Type.*
// sizes for the larger-reading knob; color, font, and corner come from
// Colors / Gen so setGeneration reskins the whole surface.

function makeStyles(scale: number = 1) {
  const fs = (n: number) => Math.round(n * scale);
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.sm, gap: Spacing.lg },

    nav: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },

    list: { gap: Spacing.sm, marginTop: Spacing.sm },
    empty: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.lg,
      ...bodyFont,
    },
    allDone: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textSecondary, fontStyle: 'italic',
      textAlign: 'center', marginTop: 80, ...bodyFont,
    },

    // ── The composer stage. A recessed rail card. ──────────────────
    stage: {
      position: 'relative',
      backgroundColor: Colors.background,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
      borderRadius: Radius.control, overflow: 'hidden',
      paddingLeft: Spacing.lg + 3, paddingRight: Spacing.lg, paddingVertical: Spacing.lg,
      gap: Spacing.md, marginTop: Spacing.sm, alignItems: 'stretch',
    },
    stageRule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: Colors.primary },
    stageCard: { marginTop: Spacing.sm },

    question: {
      fontSize: fs(Type.display.size), lineHeight: fs(Type.display.lineHeight),
      color: Colors.textPrimary, fontStyle: 'italic', fontWeight: '500',
      textAlign: 'center', ...bodyFont,
    },
    questionActions: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    },
    readBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.control, borderWidth: 1, borderColor: Colors.primary,
    },
    readBtnText: {
      fontSize: Type.eyebrow.size, fontWeight: '700', color: Colors.primary,
      letterSpacing: 0.6, textTransform: 'uppercase',
    },
    skipBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    skipBtnText: {
      fontSize: Type.eyebrow.size, fontWeight: '600', color: Colors.textMuted,
      letterSpacing: 0.6, textTransform: 'uppercase',
    },

    input: {
      minHeight: 200, padding: Spacing.md,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight), color: Colors.textPrimary,
      ...bodyFont,
    },

    micRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      justifyContent: 'center',
    },
    micBtn: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: Colors.primary,
      backgroundColor: Colors.surface,
    },
    micBtnRec: { backgroundColor: Colors.error, borderColor: Colors.error },
    micHint: {
      fontSize: fs(Type.caption.size), color: Colors.textSecondary, fontStyle: 'italic', ...bodyFont,
    },

    actions: {
      flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      justifyContent: 'center',
    },

    warnBody: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textPrimary, fontStyle: 'italic', ...bodyFont,
    },
    endSummary: {
      fontSize: fs(Type.cardTitle.size), lineHeight: fs(Type.cardTitle.lineHeight),
      color: Colors.textPrimary, fontStyle: 'italic', ...bodyFont,
    },

    // ── Library rows ───────────────────────────────────────────────
    libQuestion: {
      fontSize: fs(Type.ui.size), color: Colors.primary, fontWeight: '600',
      fontStyle: 'italic', ...bodyFont,
    },
    libBody: {
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textPrimary, ...bodyFont,
    },
    libActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 4 },
    libAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    libActionText: { fontSize: Type.caption.size, color: Colors.textSecondary, fontWeight: '600' },

    // Clean-up drawer. A surface well beneath the entry.
    draftCard: {
      marginTop: 10, padding: 14,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderLeftWidth: 3, borderLeftColor: Colors.primary,
      borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
      gap: 8,
    },
    fixLine: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 5), color: Colors.textPrimary,
      marginTop: 4, ...bodyFont,
    },
    suggestLine: {
      fontSize: fs(Type.ui.size), lineHeight: fs(Type.ui.lineHeight + 5), color: Colors.textSecondary,
      marginTop: 4, ...bodyFont,
    },
    draftInput: {
      minHeight: 140, padding: 10,
      borderRadius: Radius.control, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: fs(Type.body.size), lineHeight: fs(Type.body.lineHeight),
      color: Colors.textPrimary, ...bodyFont,
    },
    draftActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  });
}
