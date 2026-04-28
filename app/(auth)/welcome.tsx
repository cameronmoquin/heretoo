import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { DEV_MODE } from '../../lib/dev-mode';
import { useAuth } from '../../hooks/useAuth';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

type Mode = 'choice' | 'signin' | 'signup_code' | 'signup_form';

export default function WelcomeScreen() {
  const s = makeStyles();
  const { signInWithApple } = useAuth();
  const [mode, setMode] = useState<Mode>('choice');
  const [loading, setLoading] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Sign in (existing user) ──
  const handleSignIn = async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg('Email and password are required.');
      return;
    }
    try {
      setLoading('email');
      // eslint-disable-next-line no-console
      console.log('[signin] attempting', email.trim());
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      // eslint-disable-next-line no-console
      console.log('[signin] result:', {
        ok: !error,
        sessionPresent: !!data?.session,
        userId: data?.user?.id,
        error: error?.message,
      });
      if (error) throw error;
      if (!data?.session) {
        setErrorMsg('Sign-in succeeded but no session was returned. Try again.');
        return;
      }
      // Always land on the main HereToo feed after sign in.
      // Family Group is reachable from there via the sidebar / feed banner.
      const target = '/(tabs)/feed';
      // eslint-disable-next-line no-console
      console.log('[signin] navigating to', target);
      router.replace(target);
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('[signin] failed:', error);
      setErrorMsg(error?.message ?? 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(null);
    }
  };

  // ── Validate invite code ──
  const validateCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      showAlert('Invalid', 'Check your code and try again.');
      return;
    }
    // Check DB first
    const { data } = await supabase
      .from('invites')
      .select('id, accepted_by')
      .eq('invite_code', code)
      .single();

    if (data && !data.accepted_by) {
      setMode('signup_form');
    } else if (data?.accepted_by) {
      showAlert('Used', 'This code has already been claimed.');
    } else {
      // Demo bypass: any 4+ char code works
      if (code.length >= 4) setMode('signup_form');
      else showAlert('Invalid', 'Check your code.');
    }
  };

  // ── Create account (new user) ──
  const handleSignUp = async () => {
    if (!email.trim() || !password || password.length < 6) {
      showAlert('Error', 'Email and password (6+ characters) required.');
      return;
    }
    try {
      setLoading('email');
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) {
        // Link invite code
        if (inviteCode && !DEV_MODE) {
          supabase.from('invites').update({
            accepted_by: data.session.user.id,
            accepted_at: new Date().toISOString(),
          }).eq('invite_code', inviteCode.trim().toUpperCase()).then(() => {});
        }
        router.replace('/(auth)/profile-setup');
      } else {
        showAlert('Check email', 'Confirm your account to continue.');
      }
    } catch (error: any) {
      showAlert('Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      });
      if (cred.identityToken) await signInWithApple(cred.identityToken);
    } catch (e: any) { if (e.code !== 'ERR_REQUEST_CANCELED') showAlert('Failed', e.message); }
    finally { setLoading(null); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.glitchLogo}>
              <Text style={[s.logoText, s.glitchR]}>HT</Text>
              <Text style={[s.logoText, s.glitchG]}>HT</Text>
              <Text style={s.logoText}>HT</Text>
            </View>
            <Text style={s.logoSub}>heretoo</Text>
          </View>

          {/* ── Step 1: Choose ── */}
          {mode === 'choice' && (
            <View style={s.section}>
              <Button title="Sign in" onPress={() => setMode('signin')} variant="primary" size="lg" style={s.btn} />
              <Button title="Create account" onPress={() => setMode('signup_code')} variant="outline" size="lg" style={s.btn} />
            </View>
          )}

          {/* ── Sign in ── */}
          {mode === 'signin' && (
            <View style={s.section}>
              <Text style={s.headline}>Welcome back</Text>
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={(t) => { setEmail(t); setErrorMsg(null); }} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
              <TextInput style={s.input} placeholder="Password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={(t) => { setPassword(t); setErrorMsg(null); }} secureTextEntry returnKeyType="go" onSubmitEditing={handleSignIn} />
              <Button title="Sign in" onPress={handleSignIn} loading={loading === 'email'} disabled={!email.trim() || !password} variant="primary" size="lg" style={s.btn} />

              {errorMsg && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              )}

              {Platform.OS === 'ios' && (
                <>
                  <View style={s.divider}>
                    <View style={s.divLine} />
                    <Text style={s.divText}>or</Text>
                    <View style={s.divLine} />
                  </View>
                  <Button title="Continue with Apple" onPress={handleApple} loading={loading === 'apple'} variant="outline" size="md" style={s.btn} />
                </>
              )}

              <TouchableOpacity onPress={() => setMode('choice')}>
                <Text style={s.backLink}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Create account: enter code ── */}
          {mode === 'signup_code' && (
            <View style={s.section}>
              <Text style={s.headline}>Invite only</Text>
              <Text style={s.sub}>Someone you know has a code.</Text>
              <TextInput
                style={s.codeInput}
                placeholder="ENTER CODE"
                placeholderTextColor={Colors.textMuted}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={12}
                autoCorrect={false}
                onSubmitEditing={validateCode}
                returnKeyType="go"
              />
              <Button title="Enter" onPress={validateCode} variant="primary" size="lg" style={s.btn} />
              <TouchableOpacity onPress={() => setMode('choice')}>
                <Text style={s.backLink}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Create account: email + password ── */}
          {mode === 'signup_form' && (
            <View style={s.section}>
              <Text style={s.headline}>Create account</Text>
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
              <TextInput style={s.input} placeholder="Password (6+ characters)" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={handleSignUp} />
              <Button title="Create account" onPress={handleSignUp} loading={loading === 'email'} disabled={!email.trim() || !password} variant="primary" size="lg" style={s.btn} />
              <TouchableOpacity onPress={() => setMode('signup_code')}>
                <Text style={s.backLink}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.legal}>By continuing you agree to the Terms of Service and Privacy Policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: {
    flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: Spacing.xl,
    maxWidth: 400, alignSelf: 'center', width: '100%',
  },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  glitchLogo: { position: 'relative', width: 100, height: 60, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4, position: 'absolute' },
  glitchR: { color: '#FF0040', left: -2, top: -1, opacity: 0.7 },
  glitchG: { color: '#00FF88', left: 2, top: 1, opacity: 0.7 },
  logoSub: { fontSize: 13, fontWeight: '500', color: '#666', letterSpacing: 6, textTransform: 'uppercase', marginTop: 8 },
  section: { gap: 12, marginBottom: 24 },
  headline: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 4 },
  codeInput: {
    backgroundColor: '#15151F', borderWidth: 1, borderColor: '#2A2A3A', borderRadius: Radius.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '700',
    color: '#FFFFFF', textAlign: 'center', letterSpacing: 4,
  },
  input: {
    backgroundColor: '#15151F', borderWidth: 1, borderColor: '#2A2A3A', borderRadius: Radius.md,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF',
  },
  btn: { width: '100%' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#2A2A3A' },
  divText: { fontSize: 12, color: '#666' },
  backLink: { fontSize: 14, color: '#666', textAlign: 'center', paddingVertical: 8 },
  legal: { fontSize: 11, color: '#444', textAlign: 'center', marginTop: 16, lineHeight: 16 },
  errorBox: {
    backgroundColor: 'rgba(255, 0, 64, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 0, 64, 0.4)',
    borderRadius: Radius.md, padding: 12, marginTop: 4,
  },
  errorText: { color: '#FF6B6B', fontSize: 13, textAlign: 'center', lineHeight: 18 },
}); }
