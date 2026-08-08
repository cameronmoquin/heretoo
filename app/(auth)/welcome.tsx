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
 *   - Forgot password POSTs the email to /api/request-password-reset,
 *     which generates the recovery token server-side and sends a branded
 *     Resend email with a link straight to /reset-password. This bypasses
 *     Supabase's Site-URL redirect entirely.
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { HereTooLogo, HereTooMark } from '../../components/shared/Logo';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';
import { Eyebrow } from '../../components/shared/Eyebrow';

export default function WelcomeScreen() {
  const s = makeStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * Registration is open. It used to be inferred from the invite code
   * field — a blank code meant "sign in", so there was no way to make an
   * account without one, and someone who left it blank got a sign-in
   * attempt for an account that did not exist yet.
   *
   * The code is still accepted and still joins the crew it belongs to.
   * It is just no longer the difference between the two things this
   * form can do.
   */
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const isSignup = mode === 'register';

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
      // The code field is gone from the form. A code now only ever
      // arrives from a /join/CODE link, which parks it in localStorage —
      // so someone who follows an invite still lands in that crew, and
      // everyone else just gets an account. Empty means "no crew yet".
      const pending = consumePendingInviteCode();
      await doSignup(e, password, (pending ?? '').trim().toUpperCase(), handle);
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
      // 1. Validate the invite code first — fail fast before creating an
      //    auth user we would have to clean up.
      //
      //    THIS USED TO QUERY public.invites, WHICH DOES NOT EXIST. The
      //    concept rewrite dropped that table and this call was never
      //    repointed. Worse, it destructured only `data` and ignored
      //    `error`, so the missing relation surfaced as data === null,
      //    fell into the branch below, and told every single person
      //    "Invite code not found. Check the code with whoever sent it."
      //    Signup was impossible for everyone, with any code, and the
      //    copy blamed the code.
      //
      //    The real source of truth is families.invite_code, reachable
      //    through the same anon-callable RPC /join uses. Errors are
      //    read now — a broken lookup must never again masquerade as a
      //    bad code.
      //
      //    A code is optional. Given one, it must be real — silently
      //    creating an account that did not join the crew someone was
      //    handed a code for is worse than refusing.
      if (code) {
        const { data: found, error: lookupErr } = await supabase
          .rpc('find_family_by_invite_code', { code });
        if (lookupErr) throw lookupErr;
        const crew = (Array.isArray(found) ? found[0] : found) ?? null;
        if (!crew) {
          setErrorMsg('Invite code not found. Check the code with whoever sent it.');
          return;
        }
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

      // 4. Join the crew the code belongs to.
      //
      //    Was an update against public.invites marking the code used —
      //    same dead table, and it silently did nothing. A crew invite
      //    code is not consumed by one person anyway; it is the crew's
      //    standing code, which is why /family/[id] shows it with a copy
      //    button. So the new account joins rather than burning it.
      //
      //    accept_family_invite is SECURITY DEFINER because a brand-new
      //    joiner satisfies neither branch of the family_members insert
      //    policy, and it is idempotent. Non-fatal: an account that
      //    exists but did not join is recoverable from /join/{code},
      //    whereas throwing here would strand a created auth user.
      if (code) {
        const { error: joinErr } = await supabase.rpc('accept_family_invite', {
          invite_code_in: code,
          relationship_label_in: Vocab.member,
        });
        if (joinErr) {
          // eslint-disable-next-line no-console
          console.warn('[signup] account created but crew join failed', joinErr.message);
        }
      }

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
    // Our own branded endpoint mints the recovery link and sends it via
    // Resend. It always returns a generic 200, so we never learn (and
    // never reveal) whether the address has an account.
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://heretoo.social';
    try {
      await fetch(`${base}/api/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      });
    } catch {
      // Swallow — the message below stays generic regardless.
    }
    showAlert('Check your email', `If ${e} has an account, a reset link is on its way.`);
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoArea}>
            <HereTooMark size={44} color={Colors.textPrimary} />
            <HereTooLogo size={56} color={Colors.textPrimary} />
          </View>

          <View style={s.section}>
            <Eyebrow style={s.fieldLabel}>Email</Eyebrow>
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

            <Eyebrow style={s.fieldLabel}>Password</Eyebrow>
            {/* Reveal toggle. A masked field is the right default, but typing
                a long password blind on a phone keyboard turns one fat finger
                into "invalid credentials" with no way to see why. */}
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput]}
                placeholder={isSignup ? 'Choose a password (6+)' : 'Password'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                secureTextEntry={!showPassword}
                returnKeyType={isSignup ? 'next' : 'go'}
                onSubmitEditing={isSignup ? undefined : submit}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={s.revealBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onForgot} style={s.forgotBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {isSignup && (
              <>
                <Eyebrow style={s.fieldLabel}>Username</Eyebrow>
                <TextInput
                  style={s.input}
                  value={username}
                  onChangeText={(t) => { setUsername(t.toLowerCase()); setErrorMsg(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
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

            {/* The other door. Two things this form can do, both named. */}
            <Button
              title={isSignup ? 'Sign in' : 'Create account'}
              onPress={() => { setMode(isSignup ? 'signin' : 'register'); setErrorMsg(null); }}
              disabled={loading}
              variant="ghost"
              size="lg"
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
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: Spacing.xl,
    maxWidth: 420, alignSelf: 'center', width: '100%',
  },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoSub: {
    fontSize: 13, fontWeight: '500', color: Colors.textMuted, letterSpacing: 6,
    textTransform: 'uppercase', marginTop: Spacing.xs,
  },
  section: { gap: Spacing.xxs, marginBottom: Spacing.md },

  // Type / color / tracking come from the shared Eyebrow.
  fieldLabel: { marginTop: Spacing.sm, marginBottom: Spacing.xxs },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginTop: Spacing.xxs, lineHeight: 16 },

  // The input keeps its own border; the row is only a positioning context so
  // the eye can sit inside the field rather than beside it.
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  revealBtn: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },

  forgotBtn: { alignSelf: 'flex-end', paddingVertical: Spacing.xxs, paddingHorizontal: Spacing.xxs },
  forgotText: { fontSize: Type.caption.size, color: Colors.textSecondary, fontWeight: '500' },

  submitBtn: { width: '100%', marginTop: 18 },

  // A recessed well with the alarm colour on the edge and the copy.
  // The palette carries no faint-error tint, so the fill uses
  // surfaceLight rather than a frozen rgba red.
  errorBox: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.error,
    borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs,
  },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  legal: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md, lineHeight: 16,
  },
}); }
