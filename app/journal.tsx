/**
 * /journal — one writing surface, sealed by default.
 *
 * ONE PASSWORD (migration 095). Set once, the journal encrypts every
 * entry under it on this device — title and body together, inside one
 * envelope — and the server never holds anything it could turn back
 * into words. The list shows the ciphertext itself: what the server
 * sees is what you see, until the password opens it.
 *
 * Two buttons. SAVE ENTRY seals and keeps. BURN keeps nothing — no
 * row, no ash, no record; the act happened only on this screen.
 *
 * Rules this screen holds to:
 *   1. Plaintext lives in component state while the author types and is
 *      consumed by the seal mutation. It never enters a query cache.
 *   2. A decrypted body lives in reader state and dies on close.
 *   3. The journal password lives in stores/journalKey.ts — memory
 *      only, gone on reload — and is verified against the sealed
 *      sentinel, never stored, never sent.
 *
 * LEGACY. Entries from the two-instrument era remain: plaintext "open"
 * rows read as they always did; per-passphrase sealed rows fall back to
 * their own passphrase prompt when the journal password does not open
 * them. Nothing old is rewritten without the author asking.
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
  useJournalVault,
  useCreateJournalVault,
  useSaveVaultEntry,
  useUpdateVaultEntry,
  useOpenJournalEntry,
  useDeleteJournalEntry,
  vaultPayload,
  parseEntryPayload,
  VAULT_SENTINEL,
  type JournalEntry,
} from '../hooks/useJournal';
import { openEntry, isWrongPassphrase, vaultAvailable } from '../lib/vault';
import { useJournalKey } from '../stores/journalKey';
import { showAlert, showConfirm } from '../lib/alert';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type } from '../constants/design';

const MIN_PASSWORD = 8;

export default function JournalScreen() {
  // Called on every render, never memoised: makeStyles reads the mutable
  // Colors object, so caching it would freeze the palette at mount.
  const s = makeStyles();
  const canSeal = useMemo(() => vaultAvailable(), []);

  const { data: entries, isLoading } = useJournalEntries();
  const vaultQ = useJournalVault();
  const createVault = useCreateJournalVault();
  const saveEntry = useSaveVaultEntry();
  const updateEntry = useUpdateVaultEntry();
  const openLegacy = useOpenJournalEntry();
  const remove = useDeleteJournalEntry();

  const password = useJournalKey((st) => st.password);
  const unlock = useJournalKey((st) => st.unlock);

  // Composer.
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  /** Set while editing an existing vault entry through the composer. */
  const [editingId, setEditingId] = useState<string | null>(null);

  // Setup / unlock fields.
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);

  // Legacy per-entry passphrase prompt.
  const [legacyTarget, setLegacyTarget] = useState<JournalEntry | null>(null);
  const [legacyPass, setLegacyPass] = useState('');
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyBusy, setLegacyBusy] = useState(false);

  // Reader. In-memory only.
  const [reader, setReader] = useState<{
    id: string | null; title: string; body: string; editable: boolean;
  } | null>(null);

  // Drop every plaintext and password field if this screen goes away.
  // The journal password itself stays in its store for the visit.
  useEffect(() => () => {
    setBody('');
    setPass1(''); setPass2(''); setLegacyPass('');
    setReader(null);
  }, []);

  const vault = vaultQ.data ?? null;
  const unlocked = !!password;

  // ── Gate actions ─────────────────────────────────────────────────

  const onCreateVault = async () => {
    if (pass1.length < MIN_PASSWORD) {
      setGateError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (pass1 !== pass2) {
      setGateError('Those two do not match.');
      return;
    }
    setGateError(null);
    setGateBusy(true);
    try {
      await createVault.mutateAsync({ password: pass1 });
      unlock(pass1);
      setPass1(''); setPass2('');
    } catch (e: any) {
      setGateError(e?.message ?? 'Could not set the password.');
    } finally {
      setGateBusy(false);
    }
  };

  const onUnlock = async () => {
    if (!vault) return;
    if (!pass1) {
      setGateError('Type the password.');
      return;
    }
    setGateError(null);
    setGateBusy(true);
    try {
      const sentinel = await openEntry(vaultPayload(vault), pass1);
      if (sentinel !== VAULT_SENTINEL) throw new Error('That password does not open this journal.');
      unlock(pass1);
      setPass1('');
    } catch (e: any) {
      setGateError(
        isWrongPassphrase(e)
          ? 'That password does not open this journal.'
          : e?.message ?? 'Could not unlock.',
      );
    } finally {
      setGateBusy(false);
    }
  };

  // ── Composer actions ─────────────────────────────────────────────

  const onSave = async () => {
    if (!body.trim()) {
      showAlert('Nothing written yet.');
      return;
    }
    if (!password) return;
    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, title, body, password });
        setEditingId(null);
      } else {
        await saveEntry.mutateAsync({ title, body, password });
      }
      setTitle('');
      setBody('');
      setReader(null);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  // BURN keeps nothing. No row, no ash, no record. The confirm is the
  // only thing between a full page and a blank one.
  const onBurn = () => {
    if (!body.trim() && !title.trim()) return;
    showConfirm(
      'Burn it?',
      'Nothing is kept.',
      () => { setTitle(''); setBody(''); setEditingId(null); },
      'Burn', 'Cancel',
    );
  };

  // ── Reading ──────────────────────────────────────────────────────

  const onOpenRow = async (entry: JournalEntry) => {
    // Plaintext rows from the open era read directly.
    if (!entry.sealed) {
      setReader({ id: entry.id, title: entry.title ?? '', body: entry.body ?? '', editable: false });
      return;
    }
    // Sealed: the journal password first. A row it does not open is a
    // legacy per-passphrase seal; that prompt takes over.
    if (password) {
      try {
        const payload = {
          ciphertext: entry.ciphertext!, iv: entry.iv!, salt: entry.salt!,
          iterations: entry.iterations!, v: entry.crypto_v!,
        };
        const plain = await openEntry(payload, password);
        const parsed = parseEntryPayload(plain);
        setReader({ id: entry.id, title: parsed.title, body: parsed.body, editable: true });
        return;
      } catch (e) {
        if (!isWrongPassphrase(e)) {
          showAlert('Could not open', (e as any)?.message ?? 'Try again.');
          return;
        }
        // fall through to the legacy prompt
      }
    }
    setLegacyTarget(entry);
    setLegacyPass('');
    setLegacyError(null);
  };

  const onOpenLegacy = async () => {
    if (!legacyTarget) return;
    if (!legacyPass) {
      setLegacyError('Type the passphrase.');
      return;
    }
    setLegacyError(null);
    setLegacyBusy(true);
    try {
      const plain = await openLegacy.mutateAsync({ entry: legacyTarget, passphrase: legacyPass });
      const parsed = parseEntryPayload(plain);
      setReader({
        id: legacyTarget.id,
        title: parsed.title || (legacyTarget.title ?? ''),
        body: parsed.body,
        editable: false,
      });
      setLegacyTarget(null);
      setLegacyPass('');
    } catch (e: any) {
      setLegacyError(
        isWrongPassphrase(e)
          ? 'That passphrase does not open this entry.'
          : e?.message ?? 'Could not open.',
      );
    } finally {
      setLegacyBusy(false);
    }
  };

  const onEditFromReader = () => {
    if (!reader?.editable || !reader.id) return;
    setEditingId(reader.id);
    setTitle(reader.title);
    setBody(reader.body);
    setReader(null);
  };

  const onDelete = (entry: JournalEntry) => {
    showConfirm(
      'Delete this entry?',
      'This cannot be undone.',
      () => remove.mutate({ id: entry.id }),
      'Delete', 'Cancel',
    );
  };

  // ── Render ───────────────────────────────────────────────────────

  const header = (
    <View style={s.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={s.headerBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>The Journal</Text>
      <View style={s.headerBtn}>
        {unlocked && (
          <Ionicons name="lock-open-outline" size={18} color={Colors.textMuted} />
        )}
      </View>
    </View>
  );

  if (!canSeal) {
    // No Web Crypto here (insecure context, or the bare native runtime).
    // The journal encrypts or it does not exist; it does not fall back
    // to plaintext quietly.
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        {header}
        <View style={s.gate}>
          <Ionicons name="lock-closed" size={28} color={Colors.textMuted} />
          <Text style={s.gateError}>
            This device does not expose the encryption the journal needs.
            Open it over a secure connection.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (vaultQ.isLoading || isLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        {header}
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  // ── Gate: create the password, or unlock with it ─────────────────

  if (!unlocked) {
    const creating = !vault;
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        {header}
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.gate}>
            <Ionicons name="lock-closed" size={28} color={Colors.textPrimary} />
            {creating ? (
              <>
                <Text style={s.gateAssure}>
                  Entries are encrypted on this device before they travel.
                  No one — not HereToo, not anyone — can read them without
                  your password.
                </Text>
                <Text style={s.gateWarn}>
                  There is no reset and no recovery. Lose the password and
                  every entry is gone for good.
                </Text>
                <Text style={s.fieldLabel}>Journal password</Text>
                <TextInput
                  style={s.input}
                  value={pass1}
                  onChangeText={setPass1}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel="Journal password"
                />
                <Text style={s.fieldLabel}>Again</Text>
                <TextInput
                  style={s.input}
                  value={pass2}
                  onChangeText={setPass2}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel="Journal password, again"
                  onSubmitEditing={onCreateVault}
                />
                {!!gateError && <Text style={s.gateError}>{gateError}</Text>}
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={onCreateVault}
                  disabled={gateBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Create"
                >
                  {gateBusy
                    ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                    : <Text style={s.primaryBtnText}>Create</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.fieldLabel}>Journal password</Text>
                <TextInput
                  style={s.input}
                  value={pass1}
                  onChangeText={setPass1}
                  secureTextEntry
                  autoCapitalize="none"
                  accessibilityLabel="Journal password"
                  onSubmitEditing={onUnlock}
                  autoFocus
                />
                {!!gateError && <Text style={s.gateError}>{gateError}</Text>}
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={onUnlock}
                  disabled={gateBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock"
                >
                  {gateBusy
                    ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                    : <Text style={s.primaryBtnText}>Unlock</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Unlocked: composer + the sealed list ─────────────────────────

  const busy = saveEntry.isPending || updateEntry.isPending;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {header}
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.column}>
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
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.primaryBtn, s.actionBtn]}
                  onPress={onSave}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Save entry"
                >
                  {busy
                    ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                    : <Text style={s.primaryBtnText}>Save entry</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.burnBtn, s.actionBtn]}
                  onPress={onBurn}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Burn"
                >
                  <Ionicons name="flame-outline" size={16} color={Colors.onPrimary} />
                  <Text style={s.primaryBtnText}>Burn</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* The list is the proof: what the server holds is what you
                see. Ciphertext and a date, until the password. */}
            {(entries ?? []).length === 0 ? (
              <Text style={s.empty}>Empty.</Text>
            ) : (
              (entries ?? []).map((e) => <EntryRow key={e.id} entry={e} s={s} onOpen={onOpenRow} onDelete={onDelete} />)
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Legacy per-passphrase seal prompt */}
      <Modal visible={!!legacyTarget} transparent animationType="fade" onRequestClose={() => setLegacyTarget(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHead}>
              <Ionicons name="lock-closed" size={18} color={Colors.important} />
              <Text style={s.modalTitle}>Sealed under its own passphrase</Text>
            </View>
            <TextInput
              style={s.input}
              value={legacyPass}
              onChangeText={setLegacyPass}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Passphrase"
              onSubmitEditing={onOpenLegacy}
              autoFocus
            />
            {!!legacyError && <Text style={s.gateError}>{legacyError}</Text>}
            <View style={s.actions}>
              <TouchableOpacity style={[s.primaryBtn, s.actionBtn]} onPress={onOpenLegacy} disabled={legacyBusy} accessibilityRole="button" accessibilityLabel="Open">
                {legacyBusy
                  ? <ActivityIndicator color={Colors.onPrimary} size="small" />
                  : <Text style={s.primaryBtnText}>Open</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[s.ghostBtn, s.actionBtn]} onPress={() => setLegacyTarget(null)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={s.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reader */}
      <Modal visible={!!reader} transparent animationType="fade" onRequestClose={() => setReader(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            {!!reader?.title && <Text style={s.readerTitle}>{reader.title}</Text>}
            <ScrollView style={s.readerScroll}>
              <Text style={s.readerBody}>{reader?.body}</Text>
            </ScrollView>
            <View style={s.actions}>
              {reader?.editable && (
                <TouchableOpacity style={[s.primaryBtn, s.actionBtn]} onPress={onEditFromReader} accessibilityRole="button" accessibilityLabel="Edit">
                  <Text style={s.primaryBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.ghostBtn, s.actionBtn]} onPress={() => setReader(null)} accessibilityRole="button" accessibilityLabel="Close">
                <Text style={s.ghostBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── One row: ciphertext and a date ──────────────────────────────────

function EntryRow({ entry, s, onOpen, onDelete }: {
  entry: JournalEntry;
  s: ReturnType<typeof makeStyles>;
  onOpen: (e: JournalEntry) => void;
  onDelete: (e: JournalEntry) => void;
}) {
  const when = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  // The gibberish IS the row. For sealed entries the label is the stored
  // ciphertext itself — the exact bytes the server holds. A plaintext
  // row from the open era shows its own words, because that is what the
  // server holds for it, which is the honest version of the same rule.
  const label = entry.sealed
    ? (entry.ciphertext ?? '').slice(0, 96)
    : `${entry.title ? `${entry.title} — ` : ''}${(entry.body ?? '').slice(0, 80)}`;

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={s.rowMain}
        onPress={() => onOpen(entry)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={entry.sealed ? `Encrypted entry from ${when}. Open.` : `Entry from ${when}. Open.`}
      >
        <Text style={entry.sealed ? s.rowCipher : s.rowPlain} numberOfLines={2}>{label}</Text>
        <Text style={s.rowWhen}>{when}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onDelete(entry)}
        style={s.rowAction}
        accessibilityRole="button"
        accessibilityLabel="Delete"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  column: { gap: Spacing.md },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  headerBtn: { width: 32, alignItems: 'center' },
  headerTitle: { fontSize: Type.title.size, fontWeight: '700', color: Colors.textPrimary },

  gate: { padding: Spacing.lg, gap: Spacing.sm, alignItems: 'stretch', maxWidth: 440, width: '100%', alignSelf: 'center', marginTop: 24 },
  gateAssure: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  gateWarn: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.important,
  },
  gateError: { fontSize: Type.caption.size, color: Colors.error },

  fieldLabel: {
    fontSize: Type.caption.size, color: Colors.textSecondary,
    fontWeight: '600', marginTop: 6,
  },
  input: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: Type.ui.size, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },

  composer: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  titleInput: { fontSize: Type.title.size, fontWeight: '600', color: Colors.textPrimary },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  bodyInput: {
    minHeight: 140, fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 11, minHeight: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: Colors.onPrimary, fontSize: Type.ui.size, fontWeight: '700' },
  burnBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 11, minHeight: 44,
  },
  ghostBtn: {
    borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 11,
    minHeight: 44, alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: Colors.textSecondary, fontSize: Type.ui.size, fontWeight: '600' },

  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 24 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  rowMain: { flex: 1, gap: 3 },
  rowCipher: {
    fontSize: 12, lineHeight: 16, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', wordBreak: 'break-all' } as any) : {}),
  },
  rowPlain: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textPrimary },
  rowWhen: { fontSize: 11, color: Colors.textMuted },
  rowAction: { padding: 4 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: Spacing.sm,
    width: '100%', maxWidth: 480, maxHeight: '85%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: Type.ui.size, fontWeight: '700', color: Colors.textPrimary },
  readerTitle: { fontSize: Type.title.size, fontWeight: '700', color: Colors.textPrimary },
  readerScroll: { maxHeight: 420 },
  readerBody: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight + 4,
    color: Colors.textPrimary,
  },
}); }
