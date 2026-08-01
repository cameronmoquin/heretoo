/**
 * One-screen profile setup. New schema is lean:
 *   - handle (3-24 chars, [a-z0-9_])
 *   - display_name
 *   - bio (optional)
 * Profile row was already created by the handle_new_user trigger;
 * this screen just lets the user fill in real values.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';

/**
 * Derive a default handle from an email address. Strips the @domain
 * and any non-handle characters so a quick "Continue" lands a usable
 * default — the user can edit afterwards but won't be blocked at the
 * gate just because they don't feel like picking a username.
 *
 *   "rosalind@example.com"   → "rosalind"
 *   "Beatrice.M+test@x.org"  → "beatricemtest"
 *   "x"                      → "user_x"
 */
function defaultHandleFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0] ?? '';
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  if (cleaned.length >= 3) return cleaned;
  // Pad short / empty defaults so we always meet the 3-char minimum.
  return ('user_' + cleaned).slice(0, 24);
}

export default function ProfileSetupScreen() {
  const s = makeStyles();
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((st) => st.setProfile);
  // Pre-fill handle + display name from the auth user so a quick
  // "Continue" lands sensible defaults. The user can edit before
  // submitting; if they really don't want to pick anything, the
  // "Skip for now" button takes the defaults and lets them in.
  const defaultHandle = defaultHandleFromEmail(user?.email);
  const [handle, setHandle] = useState(defaultHandle);
  const [displayName, setDisplayName] = useState(
    (user as any)?.user_metadata?.display_name
      ?? defaultHandle.charAt(0).toUpperCase() + defaultHandle.slice(1),
  );
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  /** Save with whatever's currently in the inputs — used by both
   *  Continue and Skip. */
  const saveAndContinue = async (mode: 'continue' | 'skip') => {
    if (!user) return;
    // Skip mode: trust the pre-filled defaults, let the user in.
    // Continue mode: validate the inputs they actually edited.
    const cleanHandle = (handle.trim() || defaultHandle).toLowerCase();
    if (mode === 'continue') {
      if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
        showAlert('Invalid handle', 'Use 3–24 lowercase letters, numbers, and underscores.');
        return;
      }
      if (!displayName.trim()) {
        showAlert('Missing name', 'Add a display name.');
        return;
      }
    }
    if (mode === 'skip') setSkipping(true); else setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          handle: cleanHandle,
          display_name: displayName.trim() || cleanHandle,
          bio: bio.trim() || null,
        })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as any);
      // Resume a pending /join/CODE invite if the user landed here from
      // a shared crew invite link.
      let pending: string | null = null;
      try {
        pending = typeof localStorage !== 'undefined'
          ? localStorage.getItem('heretoo:pending_invite_code')
          : null;
        if (pending && typeof localStorage !== 'undefined') {
          localStorage.removeItem('heretoo:pending_invite_code');
        }
      } catch {}
      router.replace((pending ? `/join/${pending}` : '/(tabs)/feed') as any);
    } catch (e: any) {
      const msg = String(e?.message ?? 'Could not save').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        showAlert('Handle taken', 'That handle is already in use. Try another.');
      } else {
        showAlert('Could not save', e?.message ?? 'Try again.');
      }
    } finally {
      setLoading(false);
      setSkipping(false);
    }
  };

  const submit = () => saveAndContinue('continue');
  const skip = () => saveAndContinue('skip');

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Set up your profile</Text>
          <Text style={s.sub}>
            We've pre-filled some defaults so you can dive in. Tweak now or skip — you can change everything later in Settings.
          </Text>

          <Eyebrow style={s.label}>Handle</Eyebrow>
          <TextInput
            style={s.input}
            value={handle}
            onChangeText={(t) => setHandle(t.toLowerCase())}
            placeholder="rosalind"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
          />
          <Text style={s.hint}>3–24 lowercase letters, numbers, underscores.</Text>

          <Eyebrow style={s.label}>Display name</Eyebrow>
          <TextInput
            style={s.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Beatrice Messina"
            placeholderTextColor={Colors.textMuted}
            maxLength={80}
          />

          <Eyebrow style={s.label}>Bio (optional)</Eyebrow>
          <TextInput
            style={[s.input, s.textarea]}
            value={bio}
            onChangeText={setBio}
            placeholder="A line or two about you."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />

          <Button
            title={loading ? 'Saving…' : 'Continue'}
            onPress={submit}
            loading={loading}
            disabled={loading || skipping}
            variant="primary"
            size="lg"
            style={{ marginTop: Spacing.lg }}
          />
          <Button
            title={skipping ? 'Skipping…' : 'Skip for now'}
            onPress={skip}
            loading={skipping}
            disabled={loading || skipping}
            variant="ghost"
            size="md"
            style={{ marginTop: Spacing.xxs }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 480, alignSelf: 'center', width: '100%' },
  // 24 sits between Type.title (20) and Type.display (28); snapping
  // either way would visibly move this masthead.
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.sm },
  sub: { fontSize: Type.ui.size, color: Colors.textSecondary, marginTop: Spacing.xxs, marginBottom: Spacing.sm },
  // Type / color / tracking come from the shared Eyebrow.
  label: { marginTop: 18, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: Spacing.xxs },
}); }
