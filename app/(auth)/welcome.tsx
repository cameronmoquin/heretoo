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
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';

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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
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
      // If auto-confirm is off, user needs to check email
      if (!data.session) {
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
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoHere}>HERE</Text>
              <Text style={styles.logoToo}>Too</Text>
            </View>
            <Text style={styles.tagline}>Be real.</Text>
          </View>

          <View style={styles.description}>
            <Text style={styles.descText}>
              Every other platform rewards the loudest voice. This one rewards the truest one.
            </Text>
          </View>

          {mode === 'options' && (
            <View style={styles.buttons}>
              <Button
                title="Sign up"
                onPress={() => setMode('email_signup')}
                variant="primary"
                size="lg"
                style={styles.fullWidth}
              />

              <Button
                title="Google"
                onPress={handleGoogleLogin}
                loading={loading === 'google'}
                disabled={loading !== null}
                variant="outline"
                size="lg"
                style={styles.fullWidth}
              />

              {Platform.OS === 'ios' && (
                <Button
                  title="Apple"
                  onPress={handleAppleLogin}
                  loading={loading === 'apple'}
                  disabled={loading !== null}
                  variant="secondary"
                  size="lg"
                  style={styles.fullWidth}
                />
              )}

              <TouchableOpacity onPress={() => setMode('email_login')}>
                <Text style={styles.switchText}>Already have an account? Sign in</Text>
              </TouchableOpacity>
            </View>
          )}

          {(mode === 'email_login' || mode === 'email_signup') && (
            <View style={styles.buttons}>
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
                title={mode === 'email_login' ? 'Sign In' : 'Create Account'}
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
              >
                <Text style={styles.switchText}>
                  {mode === 'email_login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMode('options')}>
                <Text style={styles.backText}>Back to all options</Text>
              </TouchableOpacity>
            </View>
          )}

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
    paddingHorizontal: 24,
    justifyContent: 'center',
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  logoHere: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 48,
    color: Colors.textPrimary,
  },
  logoToo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 48,
    color: Colors.primary,
  },
  tagline: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  description: {
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  descText: {
    fontSize: 18,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  buttons: {
    gap: 12,
    marginBottom: 32,
  },
  fullWidth: {
    width: '100%',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
  },
  switchText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 4,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  terms: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
