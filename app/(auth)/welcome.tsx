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
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [mode, setMode] = useState<Mode>('choice');
  const [loading, setLoading] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ── Sign in (existing user) ──
  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    try {
      setLoading('email');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      // Auth listener in useAuth handles the redirect
    } catch (error: any) {
      showAlert('Failed', error.message);
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

  const handleGoogle = async () => {
    try { setLoading('google'); await signInWithGoogle(); }
    catch (e: any) { showAlert('Failed', e.message); }
    finally { setLoading(null); }
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
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
              <TextInput style={s.input} placeholder="Password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={handleSignIn} />
              <Button title="Sign in" onPress={handleSignIn} loading={loading === 'email'} disabled={!email.trim() || !password} variant="primary" size="lg" style={s.btn} />

              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divText}>or</Text>
                <View style={s.divLine} />
              </View>
              <View style={s.row}>
                <Button title="Google" onPress={handleGoogle} loading={loading === 'google'} variant="outline" size="md" style={s.flex} />
                {Platform.OS === 'ios' && <Button title="Apple" onPress={handleApple} loading={loading === 'apple'} variant="outline" size="md" style={s.flex} />}
              </View>

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

const s = StyleSheet.create({
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
});
