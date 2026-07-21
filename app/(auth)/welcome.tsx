/**
 * Unified welcome screen — single form, no multi-step click-through.
 *
 * Layout (top → bottom):
 *   [logo]
 *   Email
 *   Password
 *   [forgot password?]
 *   Invite code (optional)
 *   Username — appears only when invite code is filled
 *   [Sign in] OR [Create account]   ← text + behavior depends on whether
 *                                     an invite code is present
 *
 * Behaviors:
 *   - No invite code → submit calls supabase.auth.signInWithPassword
 *   - Invite code present → validate the code, then signUp with the
 *     given email/password, set the chosen handle on the new profile,
 *     and route directly to the feed (no separate profile-setup
 *     screen — handle is already chosen here)
 *   - Forgot password sends a recovery email via supabase.auth.resetPasswordForEmail
 *
 * Why this rewrite: the old multi-step (choice → signin / signup_code
 * → signup_form → profile-setup) flow added clicks for no value, and
 * the handle was being randomly assigned without the user picking it
 * upfront. This collapses everything to one form.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform,
  TouchableOpacity, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { HereTooLogo } from '../../components/shared/Logo';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function WelcomeScreen() {
  const s = makeStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSignup = inviteCode.trim().length > 0;

  /** Quick handle validity check matching the profiles table constraint. */
  const cleanHandle = (h: string) =>
    h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);

  const submit = async () => {
    setErrorMsg(null);
    const e = email.trim();
    if (!e || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }
    if (isSignup) {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      const handle = cleanHandle(username);
      if (handle.length < 3) {
        setErrorMsg('Username must be at least 3 characters (letters, numbers, underscore).');
        return;
      }
      await doSignup(e, password, inviteCode.trim().toUpperCase(), handle);
    } else {
      await doSignin(e, password);
    }
  };

  const doSignin = async (e: string, pw: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password: pw });
      if (error) throw error;
      if (!data?.session) {
        setErrorMsg('Sign-in succeeded but no session was returned. Try again.');
        return;
      }
      // Resume a pending /join/CODE invite if applicable.
      const pending = consumePendingInviteCode();
      router.replace((pending ? `/join/${pending}` : '/(tabs)/feed') as any);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const doSignup = async (e: string, pw: string, code: string, handle: string) => {
    setLoading(true);
    try {
      // 1. Validate the invite code first — fail fast before
      //    creating an auth user we'd have to clean up.
      const { data: invite } = await supabase
        .from('invites')
        .select('id, accepted_by')
        .eq('invite_code', code)
        .maybeSingle();
      if (!invite) {
        setErrorMsg(
          code.length < 4
            ? 'Invite code is too short. Check the code or leave it blank to sign in.'
            : 'Invite code not found. Check the code with whoever sent it.',
        );
        return;
      }
      if (invite.accepted_by) {
        setErrorMsg('That invite code has already been used.');
        return;
      }

      // 2. Create the auth user.
      const { data, error } = await supabase.auth.signUp({ email: e, password: pw });
      if (error) throw error;
      if (!data?.session) {
        // Email confirmation required — surface clearly.
        showAlert('Check your email', `We sent a confirmation link to ${e}. Click it, then come back and sign in.`);
        return;
      }
      const userId = data.session.user.id;

      // 3. Try to set the chosen handle. If taken, save with a
      //    suffix and tell the user to change it later.
      const { error: handleErr } = await supabase
        .from('profiles')
        .update({ handle, display_name: handle })
        .eq('id', userId);
      if (handleErr) {
        const taken = String(handleErr.message ?? '').toLowerCase().includes('duplicate');
        if (taken) {
          // Append a numeric suffix and try again, up to 3 attempts.
          let saved = false;
          for (let i = 1; i <= 3 && !saved; i++) {
            const candidate = (handle + i).slice(0, 24);
            const { error: retryErr } = await supabase
              .from('profiles')
              .update({ handle: candidate, display_name: candidate })
              .eq('id', userId);
            if (!retryErr) saved = true;
          }
        }
        // If still failing, it's not fatal — user lands on feed and
        // can change handle later in /profile/settings.
      }

      // 4. Mark the invite code as used.
      await supabase
        .from('invites')
        .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      router.replace('/(tabs)/feed' as any);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    setErrorMsg(null);
    const e = email.trim();
    if (!e) {
      setErrorMsg('Type your email above first, then tap "Forgot password".');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : 'https://heretoo.social/reset-password',
      });
      if (error) throw error;
      showAlert('Check your email', `We sent a password reset link to ${e}.`);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not send reset email. Try again.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoArea}>
            <HereTooLogo size={56} color="#FFFFFF" />
            <Text style={s.logoSub}>heretoo</Text>
          </View>

          <View style={s.section}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={(t) => { setEmail(t); setErrorMsg(null); }}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoComplete="email"
            />

            <Text style={s.fieldLabel}>Password</Text>
            <TextInput
              style={s.input}
              placeholder={isSignup ? 'Choose a password (6+)' : 'Password'}
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
              secureTextEntry
              returnKeyType={isSignup ? 'next' : 'go'}
              onSubmitEditing={isSignup ? undefined : submit}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            <TouchableOpacity onPress={onForgot} style={s.forgotBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Text style={s.fieldLabel}>Invite code (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="Leave blank to sign in"
              placeholderTextColor={Colors.textMuted}
              value={inviteCode}
              onChangeText={(t) => { setInviteCode(t.toUpperCase()); setErrorMsg(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />

            {isSignup && (
              <>
                <Text style={s.fieldLabel}>Username</Text>
                <TextInput
                  style={s.input}
                  placeholder="rosalind"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={(t) => { setUsername(t.toLowerCase()); setErrorMsg(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Text style={s.fieldHint}>3–24 lowercase letters, numbers, underscores. Change later in Settings.</Text>
              </>
            )}

            {errorMsg && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Button
              title={loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
              onPress={submit}
              loading={loading}
              disabled={loading || !email.trim() || !password || (isSignup && username.trim().length < 3)}
              variant="primary"
              size="lg"
              style={s.submitBtn}
            />
          </View>

          <Text style={s.legal}>
            By continuing you agree to the Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Pull a pending invite code stashed by the /join/[code] landing
 *  page if the user arrived through a shared invite link. */
function consumePendingInviteCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = window.localStorage.getItem('heretoo:pending_invite_code');
    if (code) {
      window.localStorage.removeItem('heretoo:pending_invite_code');
      return code;
    }
  } catch {}
  return null;
}

function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: {
    flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: Spacing.xl,
    maxWidth: 420, alignSelf: 'center', width: '100%',
  },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoSub: {
    fontSize: 13, fontWeight: '500', color: '#666', letterSpacing: 6,
    textTransform: 'uppercase', marginTop: 8,
  },
  section: { gap: 4, marginBottom: 16 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: '#A8A8BD',
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 12, marginBottom: 4,
  },
  input: {
    backgroundColor: '#15151F', borderWidth: 1, borderColor: '#2A2A3A',
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#FFFFFF',
  },
  fieldHint: { fontSize: 11, color: '#888', marginTop: 4, lineHeight: 16 },

  forgotBtn: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 4 },
  forgotText: { fontSize: 12, color: '#A8A8BD', fontWeight: '500' },

  submitBtn: { width: '100%', marginTop: 18 },

  errorBox: {
    backgroundColor: 'rgba(255, 0, 64, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 0, 64, 0.4)',
    borderRadius: Radius.md, padding: 12, marginTop: 8,
  },
  errorText: { color: '#FF6B6B', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  legal: {
    fontSize: 11, color: '#444', textAlign: 'center', marginTop: 16, lineHeight: 16,
  },
}); }
