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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useNotificationPrefs, useUpdateNotificationPrefs, type NotificationPrefs,
} from '../../../hooks/useNotificationPrefs';
import { useAuth } from '../../../hooks/useAuth';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';

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
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── EMAIL ADDRESS ────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Email address</Text>
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
            <TouchableOpacity
              style={[s.saveBtn, !emailDirty && { opacity: 0.5 }]}
              onPress={saveEmail}
              disabled={!emailDirty || update.isPending}
              activeOpacity={0.85}
            >
              <Text style={s.saveBtnText}>
                {update.isPending ? 'Saving…' : (emailDraft.trim() ? 'Save email' : 'Use account email')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── EMAIL TOGGLES ────────────────────────────────────────── */}
          <Text style={s.sectionLabel}>Email notifications</Text>
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
              label="Reactions to your posts"
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
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="America/Los_Angeles"
          placeholderTextColor="#888"
          style={{
            flex: 1,
            backgroundColor: '#F1F1F5',
            borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
            fontSize: 13, color: '#1A1A24',
            borderWidth: 1, borderColor: '#E4E4EB',
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
            backgroundColor: dirty ? '#4A6CF0' : '#E4E4EB',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: dirty ? '#FFF' : '#888', fontSize: 12, fontWeight: '600' }}>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary,
  },

  scroll: {
    padding: Spacing.md, gap: Spacing.sm, paddingBottom: 60,
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  sectionLabel: {
    fontSize: Type.eyebrow.size, lineHeight: Type.eyebrow.lineHeight,
    fontWeight: Type.eyebrow.weight, letterSpacing: Type.eyebrow.letterSpacing,
    color: Colors.textMuted, textTransform: 'uppercase',
    marginTop: Spacing.sm, marginBottom: 4, paddingHorizontal: 4,
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
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  error: { fontSize: 12, color: Colors.error },
  saveBtn: {
    paddingVertical: 11, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 18,
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
  },
  toggleRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
}); }
