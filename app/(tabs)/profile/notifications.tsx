/**
 * Notification settings.
 *
 * Lets the user enter an email (separate from their auth email if
 * preferred) and toggle which events trigger an outbound notification.
 * SMS is included in the schema but the toggle row is hidden until
 * Twilio is wired up — opting in here would otherwise send signal
 * to a system that can't deliver.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Switch,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNotificationPrefs, useUpdateNotificationPrefs, type NotificationPrefs,
} from '../../../hooks/useNotificationPrefs';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/shared/Button';
import { Eyebrow } from '../../../components/shared/Eyebrow';
import { ScreenHeader } from '../../../components/shared/ScreenHeader';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

export default function NotificationSettings() {
  const s = makeStyles();
  const { user } = useAuth();
  const { data: prefs, isLoading } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  const [emailDraft, setEmailDraft] = useState('');
  const [emailDirty, setEmailDirty] = useState(false);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // Initialize the email field from prefs once they load.
  useEffect(() => {
    if (prefs && !emailDirty) {
      setEmailDraft(prefs.notification_email ?? '');
    }
  }, [prefs?.notification_email]);

  const accountEmail = user?.email ?? null;
  const effectiveEmail = (prefs?.notification_email?.trim() || accountEmail || '').toLowerCase();

  const saveEmail = () => {
    setEmailErr(null);
    const trimmed = emailDraft.trim().toLowerCase();
    if (trimmed.length === 0) {
      // Clearing the override falls back to the account email.
      update.mutate({ notification_email: null });
      setEmailDirty(false);
      return;
    }
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(trimmed)) {
      setEmailErr('That doesn\'t look like a valid email.');
      return;
    }
    update.mutate({ notification_email: trimmed });
    setEmailDirty(false);
  };

  if (isLoading || !prefs) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScreenHeader title="Notifications" showBack style={s.header} />

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── EMAIL ADDRESS ────────────────────────────────────────── */}
          <Eyebrow style={s.sectionLabel}>Email address</Eyebrow>
          <View style={s.field}>
            <TextInput
              style={s.input}
              value={emailDraft}
              onChangeText={(t) => { setEmailDraft(t); setEmailDirty(true); setEmailErr(null); }}
              placeholder={accountEmail ?? 'you@example.com'}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            {emailErr && <Text style={s.error}>{emailErr}</Text>}
            <Button
              title={update.isPending ? 'Saving…' : (emailDraft.trim() ? 'Save email' : 'Use account email')}
              onPress={saveEmail}
              disabled={!emailDirty || update.isPending}
              size="sm"
              style={s.saveBtn}
            />
          </View>

          {/* ── EMAIL TOGGLES ────────────────────────────────────────── */}
          <Eyebrow style={s.sectionLabel}>Email notifications</Eyebrow>
          <View style={s.card}>
            <ToggleRow
              label="Email notifications"
              value={prefs.email_enabled}
              onValueChange={(v) => update.mutate({ email_enabled: v })}
              prominent
            />
            <ToggleRow
              label="New messages"
              value={prefs.email_new_message}
              onValueChange={(v) => update.mutate({ email_new_message: v })}
              disabled={!prefs.email_enabled}
            />
            <ToggleRow
              label="Crew activity (daily digest)"
              value={prefs.email_family_activity}
              onValueChange={(v) => update.mutate({ email_family_activity: v })}
              disabled={!prefs.email_enabled}
            />
            <TimezoneRow />

            <ToggleRow
              label="Stories you follow"
              value={prefs.email_subject_activity}
              onValueChange={(v) => update.mutate({ email_subject_activity: v })}
              disabled={!prefs.email_enabled}
            />

            <ToggleRow
              label="Connection requests"
              value={prefs.email_connection_request}
              onValueChange={(v) => update.mutate({ email_connection_request: v })}
              disabled={!prefs.email_enabled}
            />
            <ToggleRow
              label={`Reactions to your ${Vocab.postPlural}`}
              value={prefs.email_post_reaction}
              onValueChange={(v) => update.mutate({ email_post_reaction: v })}
              disabled={!prefs.email_enabled}
            />
            <ToggleRow
              label="Connection accepted"
              value={prefs.email_connection_accepted}
              onValueChange={(v) => update.mutate({ email_connection_accepted: v })}
              disabled={!prefs.email_enabled}
              isLast
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label, value, onValueChange, disabled, isLast, prominent,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
  prominent?: boolean;
}) {
  const s = makeStyles();
  return (
    <View style={[s.toggleRow, !isLast && s.toggleRowDivider, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[s.toggleLabel, prominent && { fontWeight: '700', fontSize: 15 }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
        thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
      />
    </View>
  );
}

/**
 * Timezone row — read + edit the user's IANA timezone string. Drives
 * which UTC hour the daily digest email is sent at (we want noon in
 * the user's local zone, not noon UTC).
 *
 * On first visit, the value is auto-detected from the browser via
 * Intl.DateTimeFormat().resolvedOptions().timeZone (handled in
 * hooks/useAuth.ts on profile fetch). This row lets the user edit
 * it explicitly if their device is reporting the wrong zone (VPN,
 * traveler, etc.).
 */
function TimezoneRow() {
  const s = makeStyles();
  const { profile } = useAuth();
  const detected = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
    catch { return ''; }
  })();
  const current = (profile as any)?.timezone || detected || 'UTC';
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const dirty = value.trim() !== current;

  const save = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const supa = (await import('../../../lib/supabase')).supabase;
      await supa.from('profiles').update({ timezone: value.trim() }).eq('id', profile.id);
    } finally { setSaving(false); }
  };

  return (
    <View style={[s.toggleRow, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
      <View>
        <Text style={s.toggleLabel}>Timezone</Text>
      </View>
      <View style={s.tzRow}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="America/Los_Angeles"
          placeholderTextColor={Colors.textMuted}
          style={s.tzInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          style={[s.tzSaveBtn, dirty ? s.tzSaveBtnOn : s.tzSaveBtnOff]}
        >
          <Text style={[s.tzSaveText, dirty ? s.tzSaveTextOn : s.tzSaveTextOff]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },

  scroll: {
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: 60,
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  sectionLabel: {
    marginTop: Spacing.sm, marginBottom: Spacing.xxs, paddingHorizontal: Spacing.xxs,
  },
  field: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 8,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  error: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.error,
  },
  saveBtn: { borderRadius: Radius.full, alignSelf: 'flex-start' },

  // Timezone row — was a hand-rolled off-palette control (#F1F1F5 /
  // #4A6CF0 / #E4E4EB). Now on tokens like everything else.
  tzRow: { flexDirection: 'row', gap: 6 },
  tzInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: Spacing.xs,
    fontSize: 13, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  tzSaveBtn: {
    paddingHorizontal: 14, paddingVertical: Spacing.xs, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  tzSaveBtnOn: { backgroundColor: Colors.primary },
  tzSaveBtnOff: { backgroundColor: Colors.surfaceLight },
  tzSaveText: { fontSize: Type.caption.size, fontWeight: '600' },
  tzSaveTextOn: { color: Colors.onPrimary },
  tzSaveTextOff: { color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: 14,
  },
  toggleRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toggleLabel: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
}); }
