/**
 * /give/admin — record a disbursement.
 *
 * Visible only to users with profile.is_donation_admin = true. Used
 * by whoever runs the platform to log each forward of funds to the
 * beneficiary organization. Each row appears immediately on the
 * public /give/transparency page.
 *
 * Schema-side, the admin gate is enforced by RLS so a non-admin
 * who finds this URL gets a polite refusal at the insert. The UI
 * also gates rendering on viewer_is_donation_admin().
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
  useIsDonationAdmin, useRecordDisbursement, useDisbursements, useDeleteDisbursement,
} from '../../hooks/useDonationTransparency';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';

export default function AdminScreen() {
  const s = makeStyles();
  const { data: isAdmin, isLoading: checkingAdmin } = useIsDonationAdmin();
  const record = useRecordDisbursement();
  const remove = useDeleteDisbursement();
  const { data: list } = useDisbursements();

  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  if (checkingAdmin) {
    return <SafeAreaView style={s.root}><ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={Colors.textMuted} />
          <Text style={s.deniedTitle}>Admin only.</Text>
          <Text style={s.deniedBody}>
            Recording disbursements requires donation-admin access. The
            transparency report is public.
          </Text>
          <TouchableOpacity onPress={() => router.replace('/give/transparency' as any)} style={s.deniedBtn}>
            <Text style={s.deniedBtnText}>See the report</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onSave = async () => {
    const dollars = parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      showAlert('Bad amount', 'Enter a positive dollar amount.');
      return;
    }
    if (beneficiary.trim().length < 2) {
      showAlert('Beneficiary name', 'Add the receiving organization\'s name.');
      return;
    }
    try {
      await record.mutateAsync({
        beneficiary,
        amount_cents: Math.round(dollars * 100),
        disbursed_at: date,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      setBeneficiary(''); setAmount(''); setReference(''); setNote('');
      setDate(new Date().toISOString().slice(0, 10));
      showAlert('Recorded', 'The disbursement is on the public report.');
    } catch (e: any) {
      showAlert('Could not save', e?.message ?? 'Try again.');
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.masthead}>
          <Eyebrow accentColor={Colors.primary} style={s.kicker}>Donation admin</Eyebrow>
          <Text style={s.title}>Record a transfer.</Text>
        </View>

        <View style={s.form}>
          <Field label="Beneficiary" value={beneficiary} onChange={setBeneficiary} />
          <Field label="Amount (USD)" value={amount} onChange={setAmount} placeholder="500.00" keyboardType="decimal-pad" />
          <Field label="Date sent" value={date} onChange={setDate} placeholder="2026-05-10" />
          <Field label="Reference (optional)" value={reference} onChange={setReference} />
          <Field label="Public note (optional)" value={note} onChange={setNote} multiline />

          <Button
            title="Record disbursement"
            onPress={onSave}
            loading={record.isPending}
            disabled={!beneficiary.trim() || !amount}
            variant="primary"
            style={s.saveBtn}
            textStyle={s.saveBtnText}
            icon={<Ionicons name="checkmark" size={16} color={Colors.onPrimary} />}
          />
        </View>

        {(list ?? []).length > 0 && (
          <View style={s.history}>
            <Eyebrow style={s.historyTitle}>Recent disbursements</Eyebrow>
            {(list ?? []).slice(0, 12).map((d) => (
              <View key={d.id} style={s.histRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.histAmount}>${(d.amount_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                  <Text style={s.histMeta}>
                    {d.beneficiary} · {d.disbursed_at}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => showConfirm(
                    'Delete this disbursement record?',
                    'It will be removed from the public report.',
                    () => remove.mutate(d.id),
                    'Delete', 'Cancel',
                  )}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  const s = makeStyles();
  return (
    <View style={s.field}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        style={[s.input, multiline && { minHeight: 64 }]}
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'decimal-pad' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center' },

  masthead: { gap: Spacing.xs },
  // Layout only; type / color / tracking come from the shared Eyebrow.
  kicker: { letterSpacing: 2 },
  // 36 falls between Type.display (28) and Type.hero (44).
  title: {
    fontSize: 36, fontWeight: '800', letterSpacing: -0.6, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  form: { gap: Spacing.sm },
  field: { gap: Spacing.xxs },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    fontSize: 15, color: Colors.textPrimary,
  },

  // Button supplies the fill, the ink, the spinner and the 44pt floor.
  saveBtn: {
    gap: 6,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: 6,
  },
  saveBtnText: { fontWeight: '700', letterSpacing: 0.2 },

  history: { gap: 6, paddingTop: Spacing.md },
  historyTitle: { marginBottom: Spacing.xxs },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  histAmount: {
    fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  histMeta: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 2 },

  deniedWrap: { padding: Spacing.xl, gap: 10, alignItems: 'flex-start' },
  deniedTitle: {
    fontSize: Type.display.size, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  deniedBody: { fontSize: Type.ui.size, lineHeight: 22, color: Colors.textSecondary },
  // Left hand-rolled: an outlined pill in the accent colour, which
  // Button's outline variant (neutral border, neutral ink) cannot express.
  deniedBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary,
    marginTop: Spacing.sm,
  },
  deniedBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
}); }
