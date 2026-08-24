/**
 * /journal — one writing surface, two destinations.
 *
 * Write the thing. Then choose. Keep it open and it stays readable,
 * and it can go on to become a book. Or seal it, and it leaves the
 * network as scrambled bytes that nobody opens without the passphrase.
 *
 * The sealing happens in lib/vault.ts, on this device, before anything
 * is sent. Rules this screen holds to:
 *
 *   1. The plaintext of a sealed entry goes into `body` state while the
 *      user types, is handed to the seal mutation, and is wiped the
 *      moment the write lands. It never enters a query cache.
 *   2. A decrypted body lives in `openedText` and nowhere else. Closing
 *      the reader clears it. Nothing writes it back.
 *   3. Passphrases live in local state for the length of one prompt and
 *      are cleared on every exit path, including the failure paths.
 *
 * Mobile-first at 393px. The column caps out on wide screens.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useJournalEntries,
  useSaveJournalEntry,
  useSealJournalEntry,
  useSealExistingEntry,
  useOpenJournalEntry,
  useDeleteJournalEntry,
  type JournalEntry,
} from '../hooks/useJournal';
import {
  useEnsureMemoirProject,
  useMemoirProject,
  useStartMemoirSession,
  useSaveMemoirResponse,
  useUpdateMemoirResponse,
  useEndMemoirSession,
} from '../hooks/useMemoir';
import { useCreateTimelineEvent } from '../hooks/useMemoirTimeline';
import { isWrongPassphrase, vaultAvailable } from '../lib/vault';
import { showAlert, showConfirm } from '../lib/alert';
import { Colors } from '../constants/colors';
import { HoverTip } from '../components/shared/HoverTip';
import { Spacing, Radius, Type } from '../constants/design';

const MIN_PASSPHRASE = 8;

/** What the seal prompt is currently being asked to do. */
type SealTarget =
  | { kind: 'new'; title: string; body: string }
  | { kind: 'existing'; id: string; title: string; body: string };

export default function JournalScreen() {
  // Called on every render, never memoised: makeStyles reads the mutable
  // Colors object, so caching it would freeze the palette at mount.
  const s = makeStyles();
  const canSeal = useMemo(() => vaultAvailable(), []);

  const { data: entries, isLoading } = useJournalEntries();
  const saveOpen = useSaveJournalEntry();
  const sealNew = useSealJournalEntry();
  const sealExisting = useSealExistingEntry();
  const openSealed = useOpenJournalEntry();
  const remove = useDeleteJournalEntry();

  // Memoir send chain. Open entries only.
  const ensureProject = useEnsureMemoirProject();
  const { data: memoirProject } = useMemoirProject(ensureProject.data);
  const startSession = useStartMemoirSession();
  const saveResponse = useSaveMemoirResponse();
  const linkResponse = useUpdateMemoirResponse();
  const createEvent = useCreateTimelineEvent();
  const endSession = useEndMemoirSession();
  const [sendingId, setSendingId] = useState<string | null>(null);
  // Entries sent to the memoir during THIS visit. Nothing records the
  // link in the database — a memoir response carries the entry's title,
  // not its id — so this resets on reload. It is enough to stop the
  // same entry being sent twice in one sitting and to flip the tip to
  // 'sent'; persisting it properly needs a column.
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Composer.
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Seal prompt.
  const [sealTarget, setSealTarget] = useState<SealTarget | null>(null);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [sealError, setSealError] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);

  // Unlock prompt.
  const [unlockTarget, setUnlockTarget] = useState<JournalEntry | null>(null);
  const [unlockPass, setUnlockPass] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Reader. In-memory only.
  const [openedText, setOpenedText] = useState<string | null>(null);
  const [openedTitle, setOpenedTitle] = useState<string>('');

  // Drop every plaintext and passphrase if this screen goes away.
  useEffect(() => () => {
    setBody('');
    setPass1(''); setPass2(''); setUnlockPass('');
    setOpenedText(null);
  }, []);

  const clearSealPrompt = () => {
    setSealTarget(null);
    setPass1(''); setPass2('');
    setSealError(null);
    setSealing(false);
  };

  const clearUnlockPrompt = () => {
    setUnlockTarget(null);
    setUnlockPass('');
    setUnlockError(null);
    setUnlocking(false);
  };

  const closeReader = () => {
    setOpenedText(null);
    setOpenedTitle('');
  };

  // ── Composer actions ─────────────────────────────────────────────

  const onKeepOpen = async () => {
    if (!body.trim()) {
      showAlert('Nothing written yet.');
      return;
    }
    try {
      await saveOpen.mutateAsync({ title, body });
      setTitle('');
      setBody('');
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  const onSealPress = () => {
    if (!body.trim()) {
      showAlert('Nothing written yet.');
      return;
    }
    if (!canSeal) {
      showAlert(
        'Sealing is unavailable here',
        'This device does not expose the encryption the seal needs. Open the journal over a secure connection.',
      );
      return;
    }
    setSealTarget({ kind: 'new', title, body });
    setPass1(''); setPass2(''); setSealError(null);
  };

  const onSealExisting = (entry: JournalEntry) => {
    if (!canSeal) {
      showAlert(
        'Sealing is unavailable here',
        'This device does not expose the encryption the seal needs. Open the journal over a secure connection.',
      );
      return;
    }
    setSealTarget({
      kind: 'existing',
      id: entry.id,
      title: entry.title ?? '',
      body: entry.body ?? '',
    });
    setPass1(''); setPass2(''); setSealError(null);
  };

  const confirmSeal = async () => {
    if (!sealTarget) return;
    if (pass1.length < MIN_PASSPHRASE) {
      setSealError(`Use at least ${MIN_PASSPHRASE} characters.`);
      return;
    }
    if (pass1 !== pass2) {
      setSealError('Those two do not match.');
      return;
    }
    setSealError(null);
    setSealing(true);
    try {
      if (sealTarget.kind === 'new') {
        await sealNew.mutateAsync({
          title: sealTarget.title,
          body: sealTarget.body,
          passphrase: pass1,
        });
        // The composer held the only other copy. Wipe it.
        setTitle('');
        setBody('');
      } else {
        await sealExisting.mutateAsync({
          id: sealTarget.id,
          body: sealTarget.body,
          passphrase: pass1,
        });
      }
      clearSealPrompt();
    } catch (e: any) {
      setSealing(false);
      setSealError(e?.message ?? 'The seal failed. Nothing was saved.');
    }
  };

  // ── Unlock ───────────────────────────────────────────────────────

  const confirmUnlock = async () => {
    if (!unlockTarget) return;
    if (!unlockPass) {
      setUnlockError('Type the passphrase.');
      return;
    }
    setUnlockError(null);
    setUnlocking(true);
    try {
      const text = await openSealed.mutateAsync({
        entry: unlockTarget,
        passphrase: unlockPass,
      });
      setOpenedTitle(unlockTarget.title ?? 'Untitled');
      setOpenedText(text);
      clearUnlockPrompt();
    } catch (e: any) {
      setUnlocking(false);
      setUnlockError(
        isWrongPassphrase(e)
          ? 'That passphrase does not open this entry.'
          : (e?.message ?? 'This entry would not open.'),
      );
    }
  };

  const onDelete = (entry: JournalEntry) => {
    showConfirm(
      entry.sealed ? 'Burn this sealed entry' : 'Delete this entry',
      entry.sealed
        ? 'The bytes go and they stay gone. Even with the passphrase, there will be nothing left to open.'
        : 'This one goes for good.',
      () => {
        remove.mutateAsync({ id: entry.id })
          .catch((e: any) => showAlert('Could not delete', e?.message ?? 'Try again.'));
      },
      'Delete forever',
    );
  };

  // Copy an OPEN entry into the memoir: ensure a project, open a session,
  // save the response. Sealed entries never reach here; their body is not
  // in memory and pushing plaintext into the memoir would defeat the seal.
  const onSendToMemoir = async (entry: JournalEntry) => {
    if (entry.sealed || sendingId) return;
    setSendingId(entry.id);
    let sessionId: string | null = null;
    try {
      let projectId = ensureProject.data ?? null;
      if (!projectId) {
        const refreshed = await ensureProject.refetch();
        projectId = refreshed.data ?? null;
      }
      if (!projectId) throw new Error('Your memoir project would not open.');

      sessionId = await startSession.mutateAsync({
        projectId,
        guidanceMode: memoirProject?.guidance_mode ?? 'socratic',
      });

      const saved = await saveResponse.mutateAsync({
        sessionId,
        projectId,
        customPromptText: entry.title?.trim() || 'Journal entry',
        transcript: entry.body ?? '',
        finalText: entry.body ?? '',
        chapterAssignment: null,
      });

      // TIMESTAMPED, AND PLACED. The entry lands on the timeline as a
      // dated event — the day it was written — so it appears on the
      // rail and opens from it. Best-effort by design: the words are
      // already saved above, and a spine that predates migration 061
      // must not turn a successful send into a failure.
      try {
        const event = await createEvent.mutateAsync({
          kind: 'custom',
          title: entry.title?.trim() || 'Journal entry',
          start_date: String(entry.created_at).slice(0, 10),
          start_precision: 'day',
          source: 'manual',
        });
        // Same link the timeline's own answer flow writes; the patch
        // passes through verbatim, so the extra column lands.
        await linkResponse.mutateAsync({
          id: (saved as any).id,
          projectId,
          patch: { timeline_event_id: event.id } as any,
        });
      } catch {}

      setSentIds((prev) => new Set(prev).add(entry.id));
      showAlert('Sent to your memoir.');
    } catch (e: any) {
      // Best effort: close an empty session so a failed send leaves
      // nothing half-written and open behind it.
      if (sessionId) {
        endSession.mutateAsync({ sessionId, summary: '', nextHint: '' }).catch(() => {});
      }
      showAlert('Could not send', e?.message ?? 'Try again.');
    } finally {
      setSendingId(null);
    }
  };

  const busy = saveOpen.isPending || sealNew.isPending || sealExisting.isPending;

  // ── Render ───────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>The Journal</Text>
        <View style={s.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.column}>
            {/* ── Composer ───────────────────────────────────── */}
            <View style={s.composer}>
              <TextInput
                style={s.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={Colors.textMuted}
                maxLength={140}
              />
              <View style={s.rule} />
              <TextInput
                style={s.bodyInput}
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* ── The fork ───────────────────────────────────── */}
            <View style={s.fork}>
              <TouchableOpacity
                style={[s.forkCard, busy && s.dim]}
                onPress={onKeepOpen}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="book-outline" size={22} color={Colors.primary} />
                <Text style={s.forkTitle}>Keep it open</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.forkCard, s.forkCardSeal, (busy || !canSeal) && s.dim]}
                onPress={onSealPress}
                disabled={busy || !canSeal}
                accessibilityRole="button"
              >
                <Ionicons name="lock-closed" size={22} color={Colors.important} />
                <Text style={s.forkTitle}>Seal it</Text>
              </TouchableOpacity>
            </View>

            {!canSeal && (
              <Text style={s.warnLine}>Sealing needs a secure connection.</Text>
            )}

            {busy && (
              <View style={s.busyRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={s.busyText}>Working.</Text>
              </View>
            )}

            {/* ── Entries ────────────────────────────────────── */}

            {isLoading && (
              <ActivityIndicator size="small" color={Colors.primary} style={s.loader} />
            )}

            {!isLoading && (entries ?? []).length === 0 && (
              <Text style={s.empty}>Empty.</Text>
            )}

            <View style={(entries ?? []).length > 0 ? s.list : undefined}>
            {(entries ?? []).map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                s={s}
                onUnlock={() => {
                  setUnlockTarget(entry);
                  setUnlockPass('');
                  setUnlockError(null);
                }}
                onRead={() => {
                  setOpenedTitle(entry.title ?? 'Untitled');
                  setOpenedText(entry.body ?? '');
                }}
                onSeal={() => onSealExisting(entry)}
                onDelete={() => onDelete(entry)}
                onSendToMemoir={() => onSendToMemoir(entry)}
                sending={sendingId === entry.id}
                sendLocked={sendingId !== null}
                sent={sentIds.has(entry.id)}
              />
            ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Seal prompt ──────────────────────────────────────── */}
      <Modal
        visible={!!sealTarget}
        transparent
        animationType="fade"
        onRequestClose={clearSealPrompt}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Ionicons name="lock-closed" size={20} color={Colors.important} />
              <Text style={s.modalTitle}>Seal this entry</Text>
            </View>

            <View style={s.dangerBox}>
              <Text style={s.dangerTitle}>Read this twice.</Text>
              <Text style={s.dangerBody}>
                Lose the passphrase and these words are gone for good. There is
                no reset link. There is no support ticket. We cannot open it for
                you, because we cannot open it at all.
              </Text>
            </View>

            <Text style={s.fieldLabel}>Passphrase</Text>
            <TextInput
              style={s.passInput}
              value={pass1}
              onChangeText={(t) => { setPass1(t); setSealError(null); }}
              placeholder={`At least ${MIN_PASSPHRASE} characters`}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fieldLabel}>Type it again</Text>
            <TextInput
              style={s.passInput}
              value={pass2}
              onChangeText={(t) => { setPass2(t); setSealError(null); }}
              placeholder="Same passphrase"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fineprint}>
              Titles are not sealed. Keep the secret out of the title.
            </Text>

            {sealError && <Text style={s.errorText}>{sealError}</Text>}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={clearSealPrompt}
                disabled={sealing}
                accessibilityRole="button"
              >
                <Text style={s.ghostBtnText}>Back out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dangerBtn, sealing && s.dim]}
                onPress={confirmSeal}
                disabled={sealing}
                accessibilityRole="button"
              >
                {sealing
                  ? <ActivityIndicator size="small" color={Colors.onPrimary} />
                  : <Text style={s.dangerBtnText}>Seal it</Text>}
              </TouchableOpacity>
            </View>

            {sealing && (
              <Text style={s.fineprint}>
                Deriving the key. This takes a moment on purpose.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Unlock prompt ────────────────────────────────────── */}
      <Modal
        visible={!!unlockTarget}
        transparent
        animationType="fade"
        onRequestClose={clearUnlockPrompt}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Ionicons name="key-outline" size={20} color={Colors.primary} />
              <Text style={s.modalTitle}>
                {unlockTarget?.title || 'Untitled'}
              </Text>
            </View>

            <TextInput
              style={s.passInput}
              value={unlockPass}
              onChangeText={(t) => { setUnlockPass(t); setUnlockError(null); }}
              placeholder="Passphrase"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={confirmUnlock}
            />

            {unlockError && <Text style={s.errorText}>{unlockError}</Text>}

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={clearUnlockPrompt}
                disabled={unlocking}
                accessibilityRole="button"
              >
                <Text style={s.ghostBtnText}>Leave it shut</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, unlocking && s.dim]}
                onPress={confirmUnlock}
                disabled={unlocking}
                accessibilityRole="button"
              >
                {unlocking
                  ? <ActivityIndicator size="small" color={Colors.onPrimary} />
                  : <Text style={s.primaryBtnText}>Open</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reader ───────────────────────────────────────────── */}
      <Modal
        visible={openedText !== null}
        transparent
        animationType="slide"
        onRequestClose={closeReader}
      >
        <View style={s.readerBackdrop}>
          <SafeAreaView style={s.readerCard} edges={['top', 'bottom']}>
            <View style={s.readerHead}>
              <Text style={s.readerTitle} numberOfLines={1}>
                {openedTitle || 'Untitled'}
              </Text>
              <TouchableOpacity
                onPress={closeReader}
                style={s.headerBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.readerScroll}>
              <Text style={s.readerBody}>{openedText}</Text>
              <Text style={s.fineprint}>
                Close this and it locks again. Nothing was written down.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Entry card ─────────────────────────────────────────────────────

function EntryCard({
  entry, s, onUnlock, onRead, onSeal, onDelete, onSendToMemoir, sending, sendLocked, sent,
}: {
  entry: JournalEntry;
  s: ReturnType<typeof makeStyles>;
  onUnlock: () => void;
  onRead: () => void;
  onSeal: () => void;
  onDelete: () => void;
  onSendToMemoir: () => void;
  sending: boolean;
  sendLocked: boolean;
  /** Already sent in this session — see sentIds in the screen. */
  sent: boolean;
}) {
  const at = new Date(entry.created_at);
  const when =
    `${at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` +
    ` · ${at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;

  if (entry.sealed) {
    return (
      <View style={[s.card, s.cardSealed]}>
        <TouchableOpacity
          style={s.cardMain}
          onPress={onUnlock}
          accessibilityRole="button"
          accessibilityLabel={`Sealed entry, ${entry.title || 'Untitled'}. Tap to enter the passphrase.`}
        >
          <View style={s.cardRow}>
            <Ionicons name="lock-closed" size={18} color={Colors.important} />
            <Text style={s.cardTitle} numberOfLines={1}>
              {entry.title || 'Untitled'}
            </Text>
          </View>
          {/* No preview. There is nothing here to preview. */}
          <Text style={s.sealedLine}>Sealed. {when}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={s.cardAction}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.cardMain}
        onPress={onRead}
        accessibilityRole="button"
      >
        <View style={s.cardRow}>
          <Ionicons name="book-outline" size={18} color={Colors.primary} />
          <Text style={s.cardTitle} numberOfLines={1}>
            {entry.title || 'Untitled'}
          </Text>
        </View>
        <Text style={s.cardPreview} numberOfLines={2}>
          {entry.body ?? ''}
        </Text>
        <Text style={s.openLine}>Open. {when}</Text>
      </TouchableOpacity>
      <View style={s.cardActions}>
        <HoverTip label={sent ? 'sent' : 'send to memoir'}>
          <TouchableOpacity
            onPress={onSendToMemoir}
            disabled={sendLocked}
            style={[s.cardAction, sendLocked && !sending && s.dim]}
            accessibilityRole="button"
            accessibilityLabel={sent ? 'Sent to memoir' : 'Send to memoir'}
          >
            {sending
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : (
                <Ionicons
                  name={sent ? 'checkmark' : 'arrow-redo-outline'}
                  size={18}
                  color={Colors.primary}
                />
              )}
          </TouchableOpacity>
        </HoverTip>
        <TouchableOpacity
          onPress={onSeal}
          style={s.cardAction}
          accessibilityRole="button"
          accessibilityLabel="Seal this entry"
        >
          <Ionicons name="lock-open-outline" size={18} color={Colors.important} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={s.cardAction}
          accessibilityRole="button"
          accessibilityLabel="Delete"
        >
          <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

function makeStyles() {
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: Colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      fontSize: Type.cardTitle.size,
      fontWeight: '600',
      color: Colors.textPrimary,
      letterSpacing: -0.2,
    },

    scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center' },


    composer: {
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      padding: Spacing.md,
    },
    titleInput: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      paddingVertical: Spacing.xxs,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginVertical: Spacing.xs,
    },
    bodyInput: {
      fontSize: Type.body.size,
      lineHeight: Type.body.lineHeight,
      color: Colors.textPrimary,
      minHeight: 160,
      paddingVertical: Spacing.xxs,
    },

    // Carries the top margin the cut fork label used to provide.
    fork: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    forkCard: {
      flex: 1,
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      gap: Spacing.xxs,
    },
    forkCardSeal: { borderColor: Colors.important },
    forkTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
      marginTop: Spacing.xxs,
    },
    dim: { opacity: 0.45 },

    warnLine: {
      fontSize: Type.caption.size,
      lineHeight: 17,
      color: Colors.important,
      marginTop: Spacing.xs,
    },

    busyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    busyText: { fontSize: 13, color: Colors.textSecondary },

    loader: { marginTop: Spacing.xl },
    // Holds the gap the cut section heading used to open up.
    list: { marginTop: Spacing.xl },
    empty: {
      fontSize: Type.ui.size,
      lineHeight: 21,
      color: Colors.textMuted,
      paddingVertical: Spacing.md,
      // Absorbs the top margin the cut section heading used to hold.
      marginTop: Spacing.xl,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surface,
      borderRadius: Radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      paddingLeft: Spacing.md,
      paddingRight: Spacing.xxs,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    cardSealed: {
      borderColor: Colors.border,
      backgroundColor: Colors.borderLight,
    },
    cardMain: { flex: 1, gap: Spacing.xxs },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    cardPreview: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },
    sealedLine: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.3 },
    openLine: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.3 },
    cardActions: { flexDirection: 'row' },
    cardAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    // Modals
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      backgroundColor: Colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.lg,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    modalTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: Colors.textPrimary,
      letterSpacing: -0.2,
    },
    // The palette carries no faint-alarm tint, so the fill uses
    // surfaceLight and the alarm colour stays on the edge.
    dangerBox: {
      backgroundColor: Colors.surfaceLight,
      borderLeftWidth: 3,
      borderLeftColor: Colors.disagree,
      borderRadius: Radius.xs,
      padding: Spacing.sm,
      marginBottom: Spacing.md,
    },
    dangerTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginBottom: Spacing.xxs,
    },
    dangerBody: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary },

    fieldLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: Colors.textMuted,
      marginBottom: Spacing.xxs,
    },
    passInput: {
      backgroundColor: Colors.background,
      borderRadius: Radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      color: Colors.textPrimary,
      fontSize: Type.body.size,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    fineprint: {
      fontSize: 11,
      lineHeight: 16,
      color: Colors.textMuted,
      marginTop: Spacing.xxs,
    },
    errorText: {
      fontSize: 13,
      lineHeight: 19,
      color: Colors.disagree,
      marginTop: Spacing.xs,
    },

    modalActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    ghostBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textSecondary },
    primaryBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: Colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { fontSize: Type.ui.size, fontWeight: '700', color: Colors.onPrimary },
    dangerBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: Colors.important,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerBtnText: { fontSize: Type.ui.size, fontWeight: '700', color: Colors.onPrimary },

    // Reader
    readerBackdrop: { flex: 1, backgroundColor: Colors.background },
    readerCard: { flex: 1, backgroundColor: Colors.background },
    readerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    readerTitle: {
      flex: 1,
      fontSize: Type.cardTitle.size,
      fontWeight: '600',
      color: Colors.textPrimary,
    },
    readerScroll: {
      padding: Spacing.md,
      paddingBottom: Spacing.xxl,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    readerBody: {
      fontSize: Type.cardTitle.size,
      lineHeight: 27,
      color: Colors.textPrimary,
      marginBottom: Spacing.lg,
    },
  });
}
