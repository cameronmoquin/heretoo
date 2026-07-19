/**
 * /letter/new — compose a new Letter.
 *
 * Source of Truth, Milestone 5.
 *
 * Layout: single 720px column, Source-Serif body type, "To" autocomplete
 * from the family graph or a free-text "future recipient" label.
 * Below the body: a date picker (default tomorrow), then a single
 * "Save and queue" button. No formatting toolbar. The composer trusts
 * the writer.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyFamilies } from '../../hooks/useFamily';
import { useCreateLetter } from '../../hooks/useLetters';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface ResolvedRecipient {
  kind: 'user';
  user_id: string;
  display: string;
}
interface FutureRecipient {
  kind: 'future';
  label: string;
  /** Optional c/o email — for unborn / underage recipients, the
   *  letter is delivered to a trusted adult's inbox. */
  careOfEmail?: string;
}
type Recipient = ResolvedRecipient | FutureRecipient;

export default function NewLetterScreen() {
  const s = makeStyles();
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draftRecipient, setDraftRecipient] = useState('');
  const [deliverAt, setDeliverAt] = useState<string>(defaultDeliveryISO());
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; handle: string | null; display_name: string | null }>>([]);
  const { data: families } = useMyFamilies();
  const create = useCreateLetter();

  const tomorrow = useMemo(() => defaultDeliveryDate(), []);

  // Search profiles in the user's family graph (3-hop) by handle/name.
  // Cheap LIKE query; results capped at 6.
  const search = async (q: string) => {
    setDraftRecipient(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, handle, display_name')
      .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(6);
    setSearchResults((data ?? []) as any[]);
  };

  const addUserRecipient = (p: { id: string; handle: string | null; display_name: string | null }) => {
    if (recipients.some((r) => r.kind === 'user' && r.user_id === p.id)) return;
    setRecipients([
      ...recipients,
      { kind: 'user', user_id: p.id, display: p.display_name || p.handle || '?' },
    ]);
    setDraftRecipient('');
    setSearchResults([]);
  };

  const addFutureRecipient = () => {
    const label = draftRecipient.trim();
    if (label.length < 2) return;
    if (recipients.some((r) => r.kind === 'future' && r.label === label)) return;
    setRecipients([...recipients, { kind: 'future', label }]);
    setDraftRecipient('');
    setSearchResults([]);
  };

  /** Update the care-of email on a future recipient row. */
  const setCareOfEmail = (idx: number, email: string) => {
    setRecipients(recipients.map((r, i) =>
      i === idx && r.kind === 'future'
        ? { ...r, careOfEmail: email.trim() || undefined }
        : r,
    ));
  };

  const removeRecipient = (idx: number) =>
    setRecipients(recipients.filter((_, i) => i !== idx));

  const onSave = async () => {
    const trimmedBody = body.trim();
    if (trimmedBody.length < 1) {
      showAlert('Empty letter', 'Write at least a sentence before queuing.');
      return;
    }
    if (recipients.length === 0) {
      showAlert('No recipient', 'Choose at least one person to receive this letter.');
      return;
    }
    const deliverDate = new Date(deliverAt);
    if (Number.isNaN(deliverDate.getTime())) {
      showAlert('Bad date', 'The delivery date must be a real date in the future.');
      return;
    }
    if (deliverDate.getTime() <= Date.now() + 60 * 1000) {
      showAlert('Too soon', 'Letters need to be queued at least a minute ahead.');
      return;
    }

    setSaving(true);
    try {
      const letter = await create.mutateAsync({
        body_md: trimmedBody,
        body_plain: trimmedBody.replace(/\*+/g, ''),
        deliver_at: deliverDate.toISOString(),
        recipients: recipients.map((r) =>
          r.kind === 'user'
            ? { kind: 'user' as const, user_id: r.user_id }
            : { kind: 'future' as const, label: r.label, careOfEmail: r.careOfEmail },
        ),
      });
      // Successful queue → take the user back to drafts list, stamping
      // the new letter as the freshest entry.
      router.replace(`/letter/${letter.id}` as any);
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>A letter</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* TO — recipient picker */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>To</Text>
          <View style={s.recipientChips}>
            {recipients.map((r, idx) => (
              <View key={idx} style={s.chip}>
                <Text style={s.chipText} numberOfLines={1}>
                  {r.kind === 'user' ? r.display : r.label}
                </Text>
                {r.kind === 'future' && (
                  <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
                )}
                <TouchableOpacity onPress={() => removeRecipient(idx)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={12} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Care-of email per future recipient — for unborn or
              underage recipients, the letter is mailed to a trusted
              adult's inbox on the chosen delivery date. */}
          {recipients.map((r, idx) => (
            r.kind === 'future' ? (
              <View key={`co-${idx}`} style={s.careOfRow}>
                <Text style={s.careOfLabel}>
                  c/o email for &quot;{r.label}&quot; <Text style={s.careOfHint}>(optional)</Text>
                </Text>
                <TextInput
                  style={s.recipientInput}
                  value={r.careOfEmail ?? ''}
                  onChangeText={(t) => setCareOfEmail(idx, t)}
                  placeholder="parent@example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            ) : null
          ))}
          <TextInput
            style={s.recipientInput}
            value={draftRecipient}
            onChangeText={search}
            placeholder='Type a name, or "my future self"'
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={() => searchResults.length === 0 && addFutureRecipient()}
          />
          {searchResults.length > 0 ? (
            <View style={s.searchPanel}>
              {searchResults.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={s.searchRow}
                  onPress={() => addUserRecipient(r)}
                  activeOpacity={0.7}
                >
                  <Text style={s.searchName}>{r.display_name || r.handle}</Text>
                  {!!r.handle && <Text style={s.searchHandle}>@{r.handle}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ) : draftRecipient.trim().length >= 2 ? (
            <TouchableOpacity style={s.futureCta} onPress={addFutureRecipient} activeOpacity={0.85}>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              <Text style={s.futureCtaText}>
                Add as a future recipient: &quot;{draftRecipient.trim()}&quot;
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* BODY — Source Serif, no toolbar */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Body</Text>
          <TextInput
            style={s.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="Write."
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* DELIVERY DATE */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Deliver on</Text>
          <TextInput
            style={s.dateInput}
            value={deliverAt.slice(0, 16)}
            onChangeText={(v) => setDeliverAt(v)}
            placeholder={tomorrow}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={s.dateHint}>
            ISO date and time. Default is tomorrow at 9:00 in your local time. Up to 80 years out.
          </Text>
        </View>

        {/* SAVE */}
        <TouchableOpacity
          style={[s.saveBtn, (saving || body.trim().length === 0 || recipients.length === 0) && { opacity: 0.4 }]}
          onPress={onSave}
          disabled={saving || body.trim().length === 0 || recipients.length === 0}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="mail-outline" size={16} color="#FFF" />
              <Text style={s.saveBtnText}>Save and queue</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function defaultDeliveryDate(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return t.toISOString().slice(0, 16);
}
function defaultDeliveryISO(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return t.toISOString();
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 14, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },

  scroll: { padding: Spacing.md, paddingBottom: 80, gap: Spacing.lg },

  field: { gap: 6 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },

  recipientChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
  },
  chipText: { fontSize: 12, color: Colors.primary, fontWeight: '600', maxWidth: 220 },

  careOfRow: { gap: 4, marginTop: 6 },
  careOfLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  careOfHint: { color: Colors.textMuted, fontWeight: '400' },
  recipientInput: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  searchPanel: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  searchRow: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  searchName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  searchHandle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  futureCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryFaint,
    alignSelf: 'flex-start',
  },
  futureCtaText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  bodyInput: {
    minHeight: 320,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    fontSize: 18, lineHeight: 28,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },

  dateInput: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  dateHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
}); }
