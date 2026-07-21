/**
 * /memoir — the single-prompt interview surface (Milestone 13).
 *
 * One prompt at a time. Source Serif 4, centered, large. The user
 * answers, the answer commits, and Claude (Socratic mode) picks the
 * next follow-up. The page deliberately has no progress bar and no
 * "47 of 300" counter; the interview is a conversation, not a quest.
 *
 * "Save and step away" ends the session and returns to the Room.
 * "Past entries" flips the page to the library view.
 *
 * Voice capture is planned for a follow-up commit; for now the
 * composer is keyboard-first, which is also the path that grandmothers
 * who already type prefer.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  type MemoirPrompt, type MemoirResponse, type CleanupResult,
} from '../../hooks/useMemoir';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useMemoirReadingMode } from '../../hooks/useMemoirReadingMode';
import { useTTS } from '../../stores/ttsStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

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
  const { elder } = reading;
  const s = makeStyles(elder);
  // Two icon colour contexts in manuscript mode: chrome icons sit on
  // the dark brand wallpaper (header bar, "Aa" toggle, library/book
  // buttons) and stay light; page icons sit inside the vellum card
  // and use sepia/bronze ink. In standard mode they collapse.
  const ic = elder ? {
    chrome: { primary: Colors.brandIvory, accent: Colors.primary, secondary: Colors.textSecondary },
    page:   { primary: '#2A1F18', accent: '#8A5B1A', secondary: '#5A4A38' },
    onAccent: '#FBF4DE',
  } : {
    chrome: { primary: Colors.textPrimary, accent: Colors.primary, secondary: Colors.textSecondary },
    page:   { primary: Colors.textPrimary, accent: Colors.primary, secondary: Colors.textSecondary },
    onAccent: '#0A0A0F',
  };
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
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.libHeader}>
            <TouchableOpacity onPress={() => setView('interview')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={20} color={ic.chrome.primary} />
            </TouchableOpacity>
            <Text style={s.kicker}>Past entries</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.libPage}>
            {(responses ?? []).length === 0 ? (
              <Text style={s.libEmpty}>Nothing saved yet.</Text>
            ) : (
              (responses ?? []).map((r) => <LibraryRow key={r.id} response={r} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Minimal chrome — back, project title, library toggle. */}
        <View style={s.header}>
          <TouchableOpacity onPress={onSaveAndStepAway} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={ic.chrome.primary} />
          </TouchableOpacity>
          <Text style={s.kicker}>{project?.title ?? 'Memoir'}</Text>
          <View style={{ flex: 1 }} />
          {(responses ?? []).length > 0 && (
            <>
              <TouchableOpacity
                style={s.libBtn}
                onPress={() => setView('library')}
                activeOpacity={0.85}
              >
                <Ionicons name="library-outline" size={14} color={ic.chrome.secondary} />
                <Text style={s.libBtnText}>Past entries</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.libBtn, { borderColor: ic.chrome.accent }]}
                onPress={() => router.push('/memoir/book')}
                activeOpacity={0.85}
              >
                <Ionicons name="book-outline" size={14} color={ic.chrome.accent} />
                <Text style={[s.libBtnText, { color: ic.chrome.accent }]}>Make the book</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={reading.toggle} style={s.aaBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.aaText}>{elder ? 'Aa' : 'Aa+'}</Text>
          </TouchableOpacity>
        </View>

        {/* Terminal state — the session wound down. Read the recap,
            then step away or begin again. No composer here. */}
        {ended ? (
          <View style={s.endCard}>
            <Text style={s.endKicker}>That&apos;s a good place to stop</Text>
            <Text style={s.endSummary}>{ended}</Text>
            <View style={s.endActions}>
              <TouchableOpacity style={s.saveBtn} onPress={onStartAnother} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={16} color={ic.onAccent} />
                <Text style={s.saveBtnText}>Keep going</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={s.stepAwayBtn} activeOpacity={0.85}>
                <Text style={s.stepAwayText}>Step away</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : !active ? (
          isPicking
            ? <ActivityIndicator color={ic.page.accent} style={{ marginTop: 80 }} />
            : <Text style={s.allDone}>You&apos;ve answered every prompt.</Text>
        ) : (
          <Animated.View style={[s.stage, { opacity: fade }]}>
            {/* Content-warning chip */}
            {showWarning && (
              <View style={s.warnCard}>
                <Text style={s.warnKicker}>This one may be tender</Text>
                <Text style={s.warnBody}>
                  The next question touches a hard subject. Answer it if you want, skip if you&apos;d
                  rather. Both are right.
                </Text>
                <View style={s.warnActions}>
                  <TouchableOpacity
                    style={s.warnContinue}
                    onPress={() => setWarningAck((prev) => ({ ...prev, [active.question]: true }))}
                    activeOpacity={0.85}
                  >
                    <Text style={s.warnContinueText}>Show the question</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.warnSkip} onPress={onSkipPrompt} activeOpacity={0.85}>
                    <Text style={s.warnSkipText}>Skip this one</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!showWarning && (
              <>
                <Text style={s.question}>{active.question}</Text>
                <View style={s.questionActions}>
                  <TouchableOpacity onPress={onReadAloud} style={s.readBtn} activeOpacity={0.85}>
                    <Ionicons
                      name={ttsActive ? 'pause' : 'volume-medium-outline'}
                      size={14}
                      color={ic.page.accent}
                    />
                    <Text style={s.readBtnText}>{ttsActive ? 'Pause' : 'Hear it read'}</Text>
                  </TouchableOpacity>
                  {active.promptId && (
                    <TouchableOpacity onPress={onSkipPrompt} style={s.skipBtn} activeOpacity={0.85}>
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
                        <ActivityIndicator color={ic.page.accent} size="small" />
                      ) : (
                        <Ionicons
                          name={voice.recording ? 'stop' : 'mic-outline'}
                          size={18}
                          color={voice.recording ? '#fff' : ic.page.accent}
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
                  <TouchableOpacity
                    style={[s.saveBtn, (save.isPending || interview.isPending || answer.trim().length < 4) && { opacity: 0.5 }]}
                    onPress={onSubmitAnswer}
                    disabled={save.isPending || interview.isPending || answer.trim().length < 4}
                    activeOpacity={0.85}
                  >
                    {(save.isPending || interview.isPending) ? (
                      <ActivityIndicator color={ic.onAccent} />
                    ) : (
                      <>
                        <Ionicons name="arrow-forward" size={16} color={ic.onAccent} />
                        <Text style={s.saveBtnText}>Save and continue</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={onSaveAndStepAway} style={s.stepAwayBtn} activeOpacity={0.85}>
                    <Text style={s.stepAwayText}>Save and step away</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Library row (past entries) ─────────────────────────────────────

function LibraryRow({ response }: { response: MemoirResponse }) {
  const { elder } = useMemoirReadingMode();
  const s = makeStyles(elder);
  // Library rows live inside the vellum page card in elder mode, so
  // their icon ink is sepia rather than the brand grey.
  const iconColor = elder ? '#5A4A38' : Colors.textSecondary;
  const tts = useTTS();
  const cleanup = useMemoirGrammarCheck();
  const resolve = useResolveCowriterDraft();
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
    <View style={s.libRow}>
      <Text style={s.libDate}>{date}</Text>
      {!!q && <Text style={s.libQuestion}>{q}</Text>}
      <Text style={s.libBody}>{response.final_text}</Text>
      <View style={s.libActions}>
        <TouchableOpacity
          onPress={() => tts.toggle(id, response.final_text)}
          style={s.libRead}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={ttsActive ? 'pause' : 'volume-medium-outline'} size={14} color={iconColor} />
          <Text style={s.libReadText}>{ttsActive ? 'Pause' : 'Read aloud'}</Text>
        </TouchableOpacity>
        {!result && (
          <TouchableOpacity
            onPress={onCleanUp}
            style={s.libPolish}
            disabled={cleanup.isPending}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {cleanup.isPending ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={14} color={iconColor} />
                <Text style={s.libReadText}>Clean up</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Clean-up drawer: mechanical fixes to apply, ideas to consider.
          The AI never rewrites the prose. */}
      {result && (
        <View style={s.draftCard}>
          {result.edits.length > 0 ? (
            <>
              <Text style={s.draftKicker}>Fixes ({result.edits.length})</Text>
              {result.edits.map((e, i) => (
                <Text key={`f${i}`} style={s.fixLine}>
                  “{e.original}” → “{e.suggested}”{e.reason ? `  (${e.reason})` : ''}
                </Text>
              ))}
            </>
          ) : (
            <Text style={s.draftKicker}>No grammar fixes needed</Text>
          )}

          {result.suggestions.length > 0 && (
            <>
              <Text style={[s.draftKicker, { marginTop: 10 }]}>Ideas to consider</Text>
              {result.suggestions.map((sug, i) => (
                <Text key={`s${i}`} style={s.suggestLine}>• {sug}</Text>
              ))}
            </>
          )}

          <View style={s.draftActions}>
            {result.edits.length > 0 && (
              <TouchableOpacity style={s.draftAccept} onPress={applyFixes} activeOpacity={0.85}>
                <Text style={s.draftAcceptText}>Apply fixes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.draftReject} onPress={() => setResult(null)} activeOpacity={0.85}>
              <Text style={s.draftRejectText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
//
// Two visual modes that share one architecture:
//
//   "manuscript" (elder=true, the default):
//     The brand wallpaper stays visible. The interview content sits in
//     a warm vellum page card on top of it — like a letter on a desk
//     lit by lamp. Dark sepia ink, real serif italic for the question,
//     book-sized type (not large-print-hospice), faint ruled lines on
//     web so the page actually feels like paper. Header chrome stays
//     light against the wallpaper so the *brand* still reads as cool.
//
//   "standard" (elder=false):
//     The existing dark ivory/gold styling, unchanged.
//
// Two colour contexts in manuscript mode:
//   chrome.*  — header bar, "Aa" toggle. On dark wallpaper.
//   page.*    — everything inside the vellum card. On parchment.

interface MemoirTokens {
  // Chrome (header, toggles) — always on the dark wallpaper.
  chromeText: string;
  chromeSecondary: string;
  chromeMuted: string;
  chromeAccent: string;
  chromeBorder: string;

  // Page (manuscript card) — on vellum in elder, same as chrome in std.
  pageCardBg: string;
  pageInk: string;
  pageInkSecondary: string;
  pageInkMuted: string;
  pageAccent: string;
  pageBorder: string;
  pageSurface: string;     // input field background within the page
  onAccent: string;        // text colour on the accent button

  // Optional web-only styling for the page card (shadow + ruled lines).
  pageCardWebExtras: object;

  // Sizes & flags.
  questionSize: number;
  questionLine: number;
  questionItalic: boolean;
  inputSize: number;
  inputLine: number;
  controlPadV: number;
  micSize: number;
  metaSize: number;
  rootBg: string;
}

function tokens(elder: boolean): MemoirTokens {
  if (elder) {
    return {
      // Chrome: same as the existing brand colours. The wallpaper is
      // visible behind the header so we don't change these.
      chromeText: Colors.brandIvory,
      chromeSecondary: Colors.textSecondary,
      chromeMuted: Colors.textMuted,
      chromeAccent: Colors.primary,
      chromeBorder: Colors.border,

      // The manuscript page — warm vellum, dark sepia ink, bronze
      // accent, ivory-cream button text.
      pageCardBg: '#F2E8CC',
      pageInk: '#2A1F18',
      pageInkSecondary: '#5A4A38',
      pageInkMuted: '#8C7E60',
      pageAccent: '#8A5B1A',
      pageBorder: '#CFC0A0',
      pageSurface: '#FBF4DE',
      onAccent: '#FBF4DE',

      // Web-only: a faint horizontal ruled-line pattern + a warm
      // shadow lift the card off the dark wallpaper. The pattern is
      // intentionally subtle (~6% opacity) — adds texture, not noise.
      pageCardWebExtras: Platform.OS === 'web' ? ({
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(95,70,40,0.07) 31px, rgba(95,70,40,0.07) 32px)',
        boxShadow:
          '0 24px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(95,70,40,0.08)',
      } as any) : {},

      // Real book sizes, not large-print-hospice.
      questionSize: 26, questionLine: 38,
      questionItalic: true,
      inputSize: 18, inputLine: 30,
      controlPadV: 14,
      micSize: 44,
      metaSize: 12,
      rootBg: 'transparent',
    };
  }

  // Standard mode: chrome and page collapse to the same dark palette
  // and there's no page card.
  return {
    chromeText: Colors.brandIvory,
    chromeSecondary: Colors.textSecondary,
    chromeMuted: Colors.textMuted,
    chromeAccent: Colors.primary,
    chromeBorder: Colors.border,

    pageCardBg: 'transparent',
    pageInk: Colors.textPrimary,
    pageInkSecondary: Colors.textSecondary,
    pageInkMuted: Colors.textMuted,
    pageAccent: Colors.primary,
    pageBorder: Colors.border,
    pageSurface: Colors.surface,
    onAccent: '#0A0A0F',
    pageCardWebExtras: {},

    questionSize: 26, questionLine: 38,
    questionItalic: true,
    inputSize: 17, inputLine: 28,
    controlPadV: 14,
    micSize: 48,
    metaSize: 11,
    rootBg: 'transparent',
  };
}

function makeStyles(elder: boolean = false) {
  const t = tokens(elder);
  // Page card (vellum) — only renders as a real card in elder/manuscript
  // mode. In standard mode `stage` is just a vertical stack and these
  // values collapse to harmless defaults.
  const pageCard = elder ? {
    backgroundColor: t.pageCardBg,
    borderRadius: 14,
    padding: 36,
    borderWidth: 1, borderColor: t.pageBorder,
    ...t.pageCardWebExtras,
  } : {};

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.rootBg, maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

    // ── Chrome (header bar) ─ always against the dark wallpaper.
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: t.chromeAccent, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    aaBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: t.chromeBorder,
      alignItems: 'center', justifyContent: 'center',
    },
    aaText: { fontSize: 14, fontWeight: '700', color: t.chromeSecondary, letterSpacing: 0.4 },
    libBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: t.chromeBorder,
    },
    libBtnText: {
      fontSize: 12, fontWeight: '700', color: t.chromeSecondary,
      letterSpacing: 0.6, textTransform: 'uppercase',
    },

    // ── The manuscript page (or vertical stack in standard) ─────────
    stage: {
      gap: Spacing.md,
      marginTop: elder ? 24 : 40,
      alignItems: 'stretch',
      ...pageCard,
    },

    question: {
      fontSize: t.questionSize, lineHeight: t.questionLine,
      color: t.pageInk,
      fontStyle: t.questionItalic ? 'italic' : 'normal',
      fontWeight: '500',
      textAlign: 'center',
      paddingHorizontal: elder ? 0 : Spacing.md,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    questionActions: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    },
    readBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: t.pageAccent,
    },
    readBtnText: {
      fontSize: 12, fontWeight: '700', color: t.pageAccent,
      letterSpacing: 0.6, textTransform: 'uppercase',
    },
    skipBtn: { paddingHorizontal: 10, paddingVertical: 6 },
    skipBtnText: {
      fontSize: 12, fontWeight: '600', color: t.pageInkMuted,
      letterSpacing: 0.6, textTransform: 'uppercase',
    },

    input: {
      minHeight: 200,
      padding: Spacing.md,
      borderRadius: elder ? 6 : Radius.lg,
      backgroundColor: t.pageSurface,
      borderWidth: 1, borderColor: t.pageBorder,
      fontSize: t.inputSize, lineHeight: t.inputLine, color: t.pageInk,
      marginTop: Spacing.sm,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    micRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginTop: Spacing.md, justifyContent: 'center',
    },
    micBtn: {
      width: t.micSize, height: t.micSize, borderRadius: t.micSize / 2,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: t.pageAccent,
      backgroundColor: elder ? t.pageSurface : 'rgba(201,161,75,0.10)',
    },
    micBtnRec: { backgroundColor: '#A23F2E', borderColor: '#A23F2E' },
    micHint: {
      fontSize: t.metaSize + 1, color: t.pageInkSecondary,
      fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    actions: {
      flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      justifyContent: 'center', marginTop: Spacing.sm,
    },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingHorizontal: 24, paddingVertical: t.controlPadV,
      borderRadius: Radius.full,
      backgroundColor: t.pageAccent,
    },
    saveBtnText: {
      color: t.onAccent,
      fontSize: 14, fontWeight: '700', letterSpacing: 0.2,
    },
    stepAwayBtn: { paddingHorizontal: 12, paddingVertical: 10 },
    stepAwayText: {
      fontSize: 13, color: t.pageInkSecondary,
      fontStyle: 'italic', textDecorationLine: 'underline',
    },

    allDone: {
      fontSize: 18, lineHeight: 28,
      color: t.pageInkSecondary,
      fontStyle: 'italic',
      textAlign: 'center', marginTop: 80,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },

    // Session-end terminal card — vellum in elder, dark in standard
    endCard: {
      marginTop: 24,
      padding: 36,
      borderRadius: 14,
      backgroundColor: elder ? t.pageCardBg : 'rgba(22, 22, 29, 0.78)',
      borderWidth: 1, borderColor: elder ? t.pageBorder : t.pageAccent,
      gap: 14,
      ...(elder ? t.pageCardWebExtras : {}),
    },
    endKicker: {
      fontSize: 12, fontWeight: '700', color: t.pageAccent, letterSpacing: 2,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    endSummary: {
      fontSize: 20, lineHeight: 32,
      color: t.pageInk,
      fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    endActions: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },

    // Trigger warning — same vellum/dark switch
    warnCard: {
      padding: 28,
      borderRadius: 14,
      backgroundColor: elder ? t.pageCardBg : 'rgba(22, 22, 29, 0.78)',
      borderLeftWidth: 4, borderLeftColor: elder ? '#9C3D2C' : t.pageAccent,
      gap: 10,
      ...(elder ? t.pageCardWebExtras : {}),
    },
    warnKicker: {
      fontSize: 12, fontWeight: '700',
      color: elder ? '#9C3D2C' : t.pageAccent,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    warnBody: {
      fontSize: 16, lineHeight: 26,
      color: t.pageInk,
      fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    warnActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    warnContinue: {
      paddingHorizontal: 16, paddingVertical: t.controlPadV - 4,
      borderRadius: Radius.full,
      backgroundColor: t.pageAccent,
    },
    warnContinueText: {
      fontSize: 13, fontWeight: '700',
      color: t.onAccent,
    },
    warnSkip: {
      paddingHorizontal: 16, paddingVertical: t.controlPadV - 4,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: t.pageBorder,
    },
    warnSkipText: {
      fontSize: 13, fontWeight: '700',
      color: t.pageInkSecondary,
    },

    // ── Library (past entries) — vellum index card in elder ────────
    libHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    libPage: {
      marginTop: 24,
      ...pageCard,
    },
    libEmpty: {
      fontSize: 17, color: t.pageInkSecondary,
      fontStyle: 'italic',
      marginTop: 24,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    libRow: {
      paddingVertical: 18, gap: 6,
      borderTopWidth: elder ? 1 : StyleSheet.hairlineWidth,
      borderTopColor: elder ? 'rgba(95,70,40,0.18)' : t.pageBorder,
    },
    libDate: {
      fontSize: 11, fontWeight: '700', color: t.pageInkMuted,
      letterSpacing: 1.4, textTransform: 'uppercase',
    },
    libQuestion: {
      fontSize: 15, color: t.pageAccent, fontWeight: '600',
      fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    libBody: {
      fontSize: 16, lineHeight: 26, color: t.pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    libActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 },
    libRead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    libPolish: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    libReadText: { fontSize: 12, color: t.pageInkSecondary, fontWeight: '600' },

    // Co-writer draft drawer — sits beneath the original response with
    // a subtle bronze border so it reads as "this is a suggestion."
    draftCard: {
      marginTop: 10,
      padding: 14,
      borderRadius: 8,
      backgroundColor: elder ? '#FBF4DE' : Colors.surface,
      borderLeftWidth: 3, borderLeftColor: t.pageAccent,
      borderWidth: StyleSheet.hairlineWidth, borderColor: t.pageBorder,
      gap: 8,
    },
    draftKicker: {
      fontSize: 11, fontWeight: '700', color: t.pageAccent,
      letterSpacing: 1.6, textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    draftBody: {
      fontSize: elder ? 17 : 15, lineHeight: elder ? 27 : 23,
      color: t.pageInk, fontStyle: 'italic',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    fixLine: {
      fontSize: elder ? 15 : 14, lineHeight: elder ? 24 : 21, color: t.pageInk,
      marginTop: 4,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    suggestLine: {
      fontSize: elder ? 15 : 14, lineHeight: elder ? 24 : 21, color: t.pageInkSecondary,
      marginTop: 4,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    draftInput: {
      minHeight: 140, padding: 10,
      borderRadius: 6, backgroundColor: elder ? '#FFFFFF' : Colors.background,
      borderWidth: 1, borderColor: t.pageBorder,
      fontSize: elder ? 17 : 15, lineHeight: elder ? 27 : 23,
      color: t.pageInk,
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
    },
    draftActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    draftAccept: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: t.pageAccent,
    },
    draftAcceptText: { fontSize: 12, fontWeight: '700', color: t.onAccent },
    draftReject: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1, borderColor: t.pageBorder,
    },
    draftRejectText: { fontSize: 12, fontWeight: '700', color: t.pageInkSecondary },
  });
}
