/**
 * /memoir — daily prompt + the user's growing memoir library.
 *
 * Today's prompt sits at the top in Source Serif italic, big and
 * inviting. A textarea below — the user writes for as long as they
 * want. A toggle: "Share this with my family" (default off — the
 * memoir is private unless the writer opts in).
 *
 * Below: the library of past responses, newest first. Tap any to
 * re-read. Future: print as a hardbound book ($80) and the
 * "Memoir of {name}" arrives by post.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTodaysMemoirPrompt, useMemoirResponses, useMemoirProgress,
  useSaveMemoirResponse, useMemoirGuidedSetting, useMemoirGrammarCheck,
  type MemoirResponse, type GrammarEdit,
} from '../../hooks/useMemoir';
import { useMyFamilies } from '../../hooks/useFamily';
import { useTTS } from '../../stores/ttsStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function MemoirScreen() {
  const s = makeStyles();
  const { data: prompt } = useTodaysMemoirPrompt();
  const { data: progress } = useMemoirProgress();
  const { data: responses } = useMemoirResponses();
  const { data: families } = useMyFamilies();
  const save = useSaveMemoirResponse();
  const guided = useMemoirGuidedSetting();
  const grammar = useMemoirGrammarCheck();
  const tts = useTTS();
  const [body, setBody] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [edits, setEdits] = useState<GrammarEdit[] | null>(null);
  const [view, setView] = useState<'write' | 'structure'>('write');

  const primaryFamilyId = (families as any[])?.[0]?.id ?? null;
  const ttsActive = !!prompt && tts.currentId === `prompt-${prompt.id}` && tts.playing;

  const onReadPrompt = () => {
    if (prompt) tts.toggle(`prompt-${prompt.id}`, prompt.prompt);
  };

  const onCheck = async () => {
    if (!body.trim()) return;
    try {
      const out = await grammar.mutateAsync({ text: body });
      setEdits(out);
      if (out.length === 0) {
        showAlert('Looks clean', 'Nothing to flag. Your writing is its own.');
      }
    } catch (e: any) {
      showAlert('Could not check', e?.message ?? 'Try again.');
    }
  };

  const acceptEdit = (e: GrammarEdit) => {
    setBody((prev) => prev.replace(e.original, e.suggested));
    setEdits((prev) => (prev ?? []).filter((x) => x !== e));
  };
  const rejectEdit = (e: GrammarEdit) => {
    setEdits((prev) => (prev ?? []).filter((x) => x !== e));
  };

  const onSave = async () => {
    if (!prompt) return;
    if (body.trim().length < 4) {
      showAlert('Write a little more', 'Even a sentence or two is enough — the memoir builds slowly.');
      return;
    }
    try {
      await save.mutateAsync({
        promptId: prompt.id,
        body,
        isShared,
        familyId: primaryFamilyId,
      });
      setBody('');
      setIsShared(false);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.kicker}>Memoir</Text>
          <View style={{ flex: 1 }} />
          {progress && progress.total_count > 0 && (
            <Text style={s.progress}>
              {progress.answered_count} / {progress.total_count}
            </Text>
          )}
          <TouchableOpacity
            style={[s.viewToggle, view === 'structure' && s.viewToggleOn]}
            onPress={() => setView(view === 'write' ? 'structure' : 'write')}
            activeOpacity={0.85}
          >
            <Ionicons
              name={view === 'structure' ? 'pencil' : 'list'}
              size={14}
              color={view === 'structure' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[s.viewToggleText, view === 'structure' && { color: Colors.primary }]}>
              {view === 'structure' ? 'Write' : 'Structure'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Guidance toggle bar — small, persistent. Lets confident
            writers turn off the starter chips entirely. */}
        <View style={s.guideBar}>
          <Ionicons name="bulb-outline" size={12} color={Colors.textMuted} />
          <Text style={s.guideText}>
            Guidance is {guided.value ? 'on' : 'off'}.
          </Text>
          <TouchableOpacity onPress={() => guided.setValue(!guided.value)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.guideToggle}>Turn {guided.value ? 'off' : 'on'}</Text>
          </TouchableOpacity>
        </View>

        {/* Structure view — groups responses by life chapter */}
        {view === 'structure' && (
          <StructurePane responses={responses ?? []} />
        )}

        {/* Today's prompt */}
        {view === 'write' && prompt ? (
          <View style={s.promptCard}>
            <View style={s.promptCardFrame} pointerEvents="none" />
            <Text style={s.promptKicker}>Today&apos;s question</Text>
            <Text style={s.promptText}>{prompt.prompt}</Text>
            <View style={s.promptActions}>
              <TouchableOpacity onPress={onReadPrompt} style={s.readBtn} activeOpacity={0.85}>
                <Ionicons
                  name={ttsActive ? 'pause' : 'volume-medium-outline'}
                  size={14}
                  color={Colors.primary}
                />
                <Text style={s.readBtnText}>{ttsActive ? 'Pause' : 'Hear it read'}</Text>
              </TouchableOpacity>
            </View>

            {/* Guidance: starter angles per prompt. Tap one and the
                composer below pre-fills with that starter so you have
                somewhere to begin. */}
            {guided.value && prompt.starters && prompt.starters.length > 0 && (
              <View style={s.startersWrap}>
                <Text style={s.startersKicker}>Pick one and start there</Text>
                <View style={s.startersGrid}>
                  {prompt.starters.map((sx, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.starterChip}
                      activeOpacity={0.85}
                      onPress={() => setBody((prev) => prev.length === 0 ? `${sx}.\n\n` : prev)}
                    >
                      <Text style={s.starterText}>{sx}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : view === 'write' ? (
          <View style={s.promptCard}>
            <Text style={s.promptText}>You&apos;ve answered every prompt in the library. The next one is coming.</Text>
          </View>
        ) : null}

        {/* Composer */}
        {view === 'write' && prompt && (
          <View style={s.composer}>
            <Text style={s.fieldLabel}>Your answer</Text>
            <TextInput
              style={s.input}
              value={body}
              onChangeText={setBody}
              placeholder="Write as much or as little as you want."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={8000}
              textAlignVertical="top"
            />
            <View style={s.shareRow}>
              <TouchableOpacity
                style={[s.shareToggle, isShared && s.shareToggleOn]}
                onPress={() => setIsShared((v) => !v)}
                activeOpacity={0.85}
              >
                <View style={[s.shareDot, isShared && { backgroundColor: Colors.primary }]} />
                <Text style={[s.shareLabel, isShared && { color: Colors.primary, fontWeight: '700' }]}>
                  Share this with my family
                </Text>
              </TouchableOpacity>
              {!primaryFamilyId && isShared && (
                <Text style={s.shareWarn}>You aren&apos;t in a family yet.</Text>
              )}
            </View>
            <View style={s.composerActions}>
              <TouchableOpacity
                style={[s.saveBtn, (save.isPending || body.trim().length < 4) && { opacity: 0.5 }]}
                onPress={onSave}
                disabled={save.isPending || body.trim().length < 4}
                activeOpacity={0.85}
              >
                {save.isPending ? (
                  <ActivityIndicator color="#0A0A0F" />
                ) : (
                  <>
                    <Ionicons name="bookmark-outline" size={16} color="#0A0A0F" />
                    <Text style={s.saveBtnText}>Save it</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.proofBtn, (grammar.isPending || body.trim().length < 10) && { opacity: 0.5 }]}
                onPress={onCheck}
                disabled={grammar.isPending || body.trim().length < 10}
                activeOpacity={0.85}
              >
                {grammar.isPending ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={14} color={Colors.primary} />
                    <Text style={s.proofBtnText}>Check writing</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Proofread suggestions — only renders when the user
                explicitly clicks Check writing. Each suggestion can
                be accepted, rejected, or ignored. */}
            {edits && edits.length > 0 && (
              <View style={s.editsBox}>
                <Text style={s.editsKicker}>{edits.length} small {edits.length === 1 ? 'note' : 'notes'} to consider</Text>
                {edits.map((e, i) => (
                  <View key={i} style={s.editRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.editOriginal}>"{e.original}"</Text>
                      <Text style={s.editArrow}>→</Text>
                      <Text style={s.editSuggested}>"{e.suggested}"</Text>
                      {!!e.reason && <Text style={s.editReason}>{e.reason}</Text>}
                    </View>
                    <View style={s.editButtons}>
                      <TouchableOpacity onPress={() => acceptEdit(e)} style={s.editAccept}>
                        <Ionicons name="checkmark" size={14} color="#0A0A0F" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => rejectEdit(e)} style={s.editReject}>
                        <Ionicons name="close" size={14} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <Text style={s.editsFootnote}>
                  Accept the ones you like; ignore the rest. The voice stays yours.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Library */}
        {view === 'write' && responses && responses.length > 0 && (
          <View style={s.library}>
            <Text style={s.libraryTitle}>Your memoir so far</Text>
            <Text style={s.libraryHint}>
              {responses.length} {responses.length === 1 ? 'answer' : 'answers'} saved.
              Read aloud whenever you want; print as a book when you&apos;re ready.
            </Text>
            {responses.map((r) => (
              <ResponseRow key={r.id} response={r} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResponseRow({ response }: { response: MemoirResponse }) {
  const s = makeStyles();
  const tts = useTTS();
  const ttsActive = tts.currentId === `memoir-${response.id}` && tts.playing;
  const onRead = () => tts.toggle(`memoir-${response.id}`, response.body);
  const date = new Date(response.created_at).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={s.responseRow}>
      <Text style={s.responseDate}>{date}</Text>
      {response.prompt && (
        <Text style={s.responsePrompt}>{response.prompt.prompt}</Text>
      )}
      <Text style={s.responseBody} numberOfLines={6}>{response.body}</Text>
      <View style={s.responseActions}>
        <TouchableOpacity onPress={onRead} style={s.responseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={ttsActive ? 'pause' : 'volume-medium-outline'}
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
        {response.is_shared && (
          <View style={s.sharedBadge}>
            <Ionicons name="leaf-outline" size={11} color={Colors.primary} />
            <Text style={s.sharedBadgeText}>Shared with family</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Structure view ─────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  childhood: 'Childhood',
  origin: 'Family of origin',
  'coming-of-age': 'Coming of age',
  love: 'Love and marriage',
  work: 'Work and purpose',
  parenting: 'Parenting',
  reflection: 'Reflections',
};

const CATEGORY_ORDER = [
  'childhood', 'origin', 'coming-of-age', 'love', 'work', 'parenting', 'reflection',
];

function StructurePane({ responses }: { responses: MemoirResponse[] }) {
  const s = makeStyles();

  // Group responses by their prompt's category (we joined the prompt
  // when fetching responses).
  const byCategory: Record<string, MemoirResponse[]> = {};
  for (const r of responses) {
    const c = r.prompt?.category ?? 'other';
    (byCategory[c] = byCategory[c] ?? []).push(r);
  }

  if (responses.length === 0) {
    return (
      <View style={s.structureEmpty}>
        <Text style={s.structureEmptyTitle}>The structure appears once you start.</Text>
        <Text style={s.structureEmptyBody}>
          Answer a prompt or two, then come back. The chapters will draw themselves
          around what you write.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.md }}>
      <Text style={s.structureIntro}>
        Your memoir, the way the prompts have grouped it. Each section is a chapter
        in waiting.
      </Text>
      {CATEGORY_ORDER.map((cat) => {
        const list = byCategory[cat] ?? [];
        if (list.length === 0) return null;
        return (
          <View key={cat} style={s.chapter}>
            <View style={s.chapterHead}>
              <Text style={s.chapterTitle}>{CATEGORY_LABEL[cat] ?? cat}</Text>
              <Text style={s.chapterCount}>
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            {list.map((r) => (
              <View key={r.id} style={s.chapterRow}>
                <Text style={s.chapterRowQ}>{r.prompt?.prompt}</Text>
                <Text style={s.chapterRowA} numberOfLines={2}>{r.body}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  progress: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  promptCard: {
    position: 'relative',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderWidth: 1, borderColor: Colors.primary,
    gap: 14,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  promptCardFrame: {
    position: 'absolute', top: 12, left: 12, right: 12, bottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.primary,
    opacity: 0.35, borderRadius: Radius.md, pointerEvents: 'none',
  },
  promptKicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2.4,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  promptText: {
    fontSize: 26, lineHeight: 38, fontWeight: '500', color: Colors.brandIvory,
    fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  promptActions: { flexDirection: 'row', gap: 8 },
  readBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  readBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.6, textTransform: 'uppercase' },

  composer: { gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  input: {
    minHeight: 200,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    fontSize: 17, lineHeight: 28, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  shareRow: { gap: 4 },
  shareToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  shareToggleOn: { borderColor: Colors.primary, backgroundColor: 'rgba(201,161,75,0.12)' },
  shareDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.textMuted,
  },
  shareLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  shareWarn: { fontSize: 11, color: Colors.textMuted, marginLeft: 12 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignSelf: 'flex-start',
    marginTop: 4,
  },
  saveBtnText: { color: '#0A0A0F', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  library: { gap: 10 },
  libraryTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.brandIvory, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  libraryHint: {
    fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: 8,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  responseRow: {
    paddingVertical: 14,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  responseDate: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.4, textTransform: 'uppercase',
  },
  responsePrompt: {
    fontSize: 14, color: Colors.primary, fontWeight: '600', fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  responseBody: {
    fontSize: 15, lineHeight: 24, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  responseActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  responseBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sharedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  sharedBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },

  // View toggle
  viewToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  viewToggleOn: { borderColor: Colors.primary, backgroundColor: 'rgba(201,161,75,0.10)' },
  viewToggleText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.6, textTransform: 'uppercase' },

  // Guide bar
  guideBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(22, 22, 29, 0.4)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  guideText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  guideToggle: { fontSize: 11, color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },

  // Starters
  startersWrap: { gap: 8, marginTop: 4 },
  startersKicker: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.6, textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  startersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  starterChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(244, 241, 232, 0.06)',
    borderWidth: 1, borderColor: Colors.border,
  },
  starterText: {
    fontSize: 12, color: Colors.textPrimary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  // Composer actions
  composerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  proofBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  proofBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Edits
  editsBox: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.6)',
    borderLeftWidth: 2, borderLeftColor: Colors.primary,
    gap: 10, marginTop: 4,
  },
  editsKicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  editRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  editOriginal: {
    fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic',
    textDecorationLine: 'line-through',
  },
  editArrow: { fontSize: 11, color: Colors.textMuted },
  editSuggested: { fontSize: 13, color: Colors.brandIvory, fontWeight: '600' },
  editReason: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  editButtons: { flexDirection: 'row', gap: 6 },
  editAccept: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  editReject: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  editsFootnote: {
    fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  // Structure
  structureIntro: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  chapter: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 6,
  },
  chapterHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  chapterTitle: {
    fontSize: 18, fontWeight: '800', color: Colors.brandIvory, letterSpacing: -0.3,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  chapterCount: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
  },
  chapterRow: { paddingVertical: 6, gap: 2 },
  chapterRowQ: {
    fontSize: 12, color: Colors.primary, fontWeight: '600', fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  chapterRowA: {
    fontSize: 13, color: Colors.textPrimary, lineHeight: 19,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  structureEmpty: { padding: Spacing.xl, gap: 8 },
  structureEmptyTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  structureEmptyBody: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
