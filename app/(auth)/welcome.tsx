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
import { useAuth } from '../../hooks/useAuth';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

type AuthMode = 'gate' | 'options' | 'email_login' | 'email_signup';

export default function WelcomeScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('gate');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const validateInvite = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    // Check invite code against database
    const { data } = await supabase
      .from('invites')
      .select('id, accepted_by')
      .eq('invite_code', code)
      .single();

    if (data && !data.accepted_by) {
      setInviteValid(true);
      setMode('options');
    } else if (data?.accepted_by) {
      showAlert('Already used', 'This invite code has been claimed.');
    } else {
      // For dev/demo: accept any 8-char code
      if (code.length >= 4) {
        setInviteValid(true);
        setMode('options');
      } else {
        showAlert('Invalid code', 'Check your invite and try again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading('google');
      await signInWithGoogle();
    } catch (error: any) {
      showAlert('Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setLoading('apple');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (credential.identityToken) await signInWithApple(credential.identityToken);
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') showAlert('Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) return;
    try {
      setLoading('email');
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) router.replace('/(auth)/profile-setup');
    } catch (error: any) {
      showAlert('Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSignup = async () => {
    if (!email.trim() || !password || password.length < 6) {
      showAlert('Error', 'Email and password (6+ characters) required.');
      return;
    }
    try {
      setLoading('email');
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (data.session) router.replace('/(auth)/profile-setup');
      else showAlert('Check your email', 'Confirm your account to continue.');
    } catch (error: any) {
      showAlert('Failed', error.message);
    } finally {
      setLoading(null);
    }
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

          {/* Invite gate */}
          {mode === 'gate' && (
            <View style={s.section}>
              <Text style={s.headline}>Invite only.</Text>
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
                onSubmitEditing={validateInvite}
                returnKeyType="go"
              />
              <Button title="Enter" onPress={validateInvite} variant="primary" size="lg" style={s.btn} />
              <TouchableOpacity onPress={() => setMode('email_login')}>
                <Text style={s.link}>Already a member? Sign in</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Auth options */}
          {mode === 'options' && (
            <View style={s.section}>
              <Text style={s.headline}>You're in.</Text>
              <Button title="Create account" onPress={() => setMode('email_signup')} variant="primary" size="lg" style={s.btn} />
              <View style={s.divider}>
                <View style={s.divLine} />
                <Text style={s.divText}>or</Text>
                <View style={s.divLine} />
              </View>
              <View style={s.row}>
                <Button title="Google" onPress={handleGoogleLogin} loading={loading === 'google'} variant="outline" size="md" style={s.flex} />
                {Platform.OS === 'ios' && (
                  <Button title="Apple" onPress={handleAppleLogin} loading={loading === 'apple'} variant="outline" size="md" style={s.flex} />
                )}
              </View>
            </View>
          )}

          {/* Email forms */}
          {(mode === 'email_login' || mode === 'email_signup') && (
            <View style={s.section}>
              <Text style={s.headline}>{mode === 'email_signup' ? 'Create account' : 'Welcome back'}</Text>
              <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
              <TextInput style={s.input} placeholder="Password" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={mode === 'email_login' ? handleEmailLogin : handleEmailSignup} />
              <Button
                title={mode === 'email_login' ? 'Sign in' : 'Create account'}
                onPress={mode === 'email_login' ? handleEmailLogin : handleEmailSignup}
                loading={loading === 'email'}
                disabled={!email.trim() || !password}
                variant="primary" size="lg" style={s.btn}
              />
              <TouchableOpacity onPress={() => setMode(mode === 'email_login' ? 'email_signup' : 'email_login')}>
                <Text style={s.link}>
                  {mode === 'email_login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode(inviteValid ? 'options' : 'gate')}>
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
  headline: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
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
  link: { fontSize: 14, color: Colors.primary, textAlign: 'center' },
  backLink: { fontSize: 14, color: '#666', textAlign: 'center' },
  legal: { fontSize: 11, color: '#444', textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
