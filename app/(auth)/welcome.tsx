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

type AuthMode = 'options' | 'email_login' | 'email_signup';

export default function WelcomeScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading('google');
      await signInWithGoogle();
    } catch (error: any) {
      showAlert('Sign In Failed', error.message);
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
      if (credential.identityToken) {
        await signInWithApple(credential.identityToken);
      }
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        showAlert('Sign In Failed', error.message);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) return;
    try {
      setLoading('email');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) router.replace('/(auth)/profile-setup');
    } catch (error: any) {
      showAlert('Sign In Failed', error.message);
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/(auth)/profile-setup');
      } else {
        showAlert('Check your email', 'Confirm your account to continue.');
      }
    } catch (error: any) {
      showAlert('Sign Up Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Text style={styles.logoMark}>
              <Text style={styles.logoHere}>HERE</Text>
              <Text style={styles.logoToo}>Too</Text>
            </Text>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>Be real.</Text>
          <Text style={styles.sub}>
            The platform that rewards what people actually share.
          </Text>

          {/* Auth */}
          <View style={styles.authArea}>
            {mode === 'options' && (
              <>
                <Button
                  title="Create account"
                  onPress={() => setMode('email_signup')}
                  variant="primary"
                  size="lg"
                  style={styles.btn}
                />
                <Button
                  title="Sign in"
                  onPress={() => setMode('email_login')}
                  variant="outline"
                  size="lg"
                  style={styles.btn}
                />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialRow}>
                  <Button
                    title="Google"
                    onPress={handleGoogleLogin}
                    loading={loading === 'google'}
                    variant="outline"
                    size="md"
                    style={styles.socialBtn}
                  />
                  {Platform.OS === 'ios' && (
                    <Button
                      title="Apple"
                      onPress={handleAppleLogin}
                      loading={loading === 'apple'}
                      variant="outline"
                      size="md"
                      style={styles.socialBtn}
                    />
                  )}
                </View>
              </>
            )}

            {(mode === 'email_login' || mode === 'email_signup') && (
              <>
                <Text style={styles.formTitle}>
                  {mode === 'email_signup' ? 'Create your account' : 'Welcome back'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <Button
                  title={mode === 'email_login' ? 'Sign in' : 'Create account'}
                  onPress={mode === 'email_login' ? handleEmailLogin : handleEmailSignup}
                  loading={loading === 'email'}
                  disabled={!email.trim() || !password}
                  variant="primary"
                  size="lg"
                  style={styles.btn}
                />
                <TouchableOpacity
                  onPress={() => setMode(mode === 'email_login' ? 'email_signup' : 'email_login')}
                >
                  <Text style={styles.switchText}>
                    {mode === 'email_login' ? 'Need an account? ' : 'Have an account? '}
                    <Text style={styles.switchBold}>
                      {mode === 'email_login' ? 'Sign up' : 'Sign in'}
                    </Text>
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('options')}>
                  <Text style={styles.backLink}>All options</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.legal}>
            By continuing you agree to the Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: Spacing.xl,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  logoArea: { alignItems: 'center', marginBottom: 12 },
  logoMark: { fontSize: 44 },
  logoHere: { fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  logoToo: { fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  authArea: { gap: 12, marginBottom: Spacing.lg },
  btn: { width: '100%' },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  dividerText: { fontSize: 13, fontWeight: '400', color: Colors.textMuted },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: { flex: 1 },
  switchText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  switchBold: { fontWeight: '600', color: Colors.primary },
  backLink: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  legal: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
