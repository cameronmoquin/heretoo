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
import { Spacing, Radius } from '../../constants/design';

export default function ProfileSetupScreen() {
  const s = makeStyles();
  const user = useAuthStore((s) => s.user);
  const setProfile = useAuthStore((st) => st.setProfile);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return;
    const cleanHandle = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanHandle)) {
      showAlert('Invalid handle', 'Use 3–24 lowercase letters, numbers, and underscores.');
      return;
    }
    if (!displayName.trim()) {
      showAlert('Missing name', 'Add a display name.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          handle: cleanHandle,
          display_name: displayName.trim(),
          bio: bio.trim() || null,
        })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data as any);
      // Resume a pending /join/CODE invite if the user landed here from
      // a shared family invite link.
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
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>Set up your profile</Text>
          <Text style={s.sub}>One screen. You can change all of this later.</Text>

          <Text style={s.label}>Handle</Text>
          <TextInput
            style={s.input}
            value={handle}
            onChangeText={(t) => setHandle(t.toLowerCase())}
            placeholder="cameron"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={24}
          />
          <Text style={s.hint}>3–24 lowercase letters, numbers, underscores.</Text>

          <Text style={s.label}>Display name</Text>
          <TextInput
            style={s.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Cameron Moquin"
            placeholderTextColor={Colors.textMuted}
            maxLength={80}
          />

          <Text style={s.label}>Bio (optional)</Text>
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
            disabled={loading}
            variant="primary"
            size="lg"
            style={{ marginTop: 24 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 480, alignSelf: 'center', width: '100%' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginTop: 12 },
  sub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  label: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
}); }
