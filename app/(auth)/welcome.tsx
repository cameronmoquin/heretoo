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
import { Fonts } from '../../constants/typography';
import { Shadow, Radius, Spacing } from '../../constants/design';

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
      if (data.session) {
        router.replace('/(auth)/profile-setup');
      }
    } catch (error: any) {
      showAlert('Sign In Failed', error.message);
    } finally {
      setLoading(null);
    }
  };

  const handleEmailSignup = async () => {
    if (!email.trim() || !password || password.length < 6) {
      showAlert('Error', 'Please enter a valid email and password (6+ characters).');
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + Tagline */}
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Text style={styles.logoHere}>HERE</Text>
              <Text style={styles.logoToo}>Too</Text>
            </View>
            <Text style={styles.tagline}>Be real.</Text>
          </View>

          {/* Value prop */}
          <Text style={styles.pitch}>
            Every other platform rewards the loudest voice.{'\n'}
            This one rewards the truest one.
          </Text>

          {/* Auth card */}
          <View style={styles.authCard}>
            {mode === 'options' && (
              <>
                <Button
                  title="Sign up with email"
                  onPress={() => setMode('email_signup')}
                  variant="primary"
                  size="lg"
                  style={styles.fullWidth}
                />

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Button
                  title="Continue with Google"
                  onPress={handleGoogleLogin}
                  loading={loading === 'google'}
                  disabled={loading !== null}
                  variant="outline"
                  size="lg"
                  style={styles.fullWidth}
                />

                {Platform.OS === 'ios' && (
                  <Button
                    title="Continue with Apple"
                    onPress={handleAppleLogin}
                    loading={loading === 'apple'}
                    disabled={loading !== null}
                    variant="secondary"
                    size="lg"
                    style={styles.fullWidth}
                  />
                )}

                <TouchableOpacity
                  onPress={() => setMode('email_login')}
                  style={styles.switchLink}
                >
                  <Text style={styles.switchText}>
                    Already have an account? <Text style={styles.switchBold}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
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
                  autoComplete={mode === 'email_signup' ? 'new-password' : 'current-password'}
                />

                <Button
                  title={mode === 'email_login' ? 'Sign in' : 'Create account'}
                  onPress={mode === 'email_login' ? handleEmailLogin : handleEmailSignup}
                  loading={loading === 'email'}
                  disabled={!email.trim() || !password}
                  variant="primary"
                  size="lg"
                  style={styles.fullWidth}
                />

                <TouchableOpacity
                  onPress={() =>
                    setMode(mode === 'email_login' ? 'email_signup' : 'email_login')
                  }
                  style={styles.switchLink}
                >
                  <Text style={styles.switchText}>
                    {mode === 'email_login'
                      ? "Don't have an account? "
                      : 'Already have an account? '}
                    <Text style={styles.switchBold}>
                      {mode === 'email_login' ? 'Sign up' : 'Sign in'}
                    </Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMode('options')}
                  style={styles.switchLink}
                >
                  <Text style={styles.backText}>All sign in options</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to HereToo's Terms of Service and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoMark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  logoHere: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 52,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  logoToo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 52,
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'lowercase',
  },
  pitch: {
    fontSize: 17,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  authCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.md,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  formTitle: {
    fontSize: 20,
    fontFamily: Fonts.heading,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  fullWidth: {
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
  },
  switchLink: {
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  switchBold: {
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  terms: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
  },
});
