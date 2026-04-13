import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';

export default function WelcomeScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [loading, setLoading] = React.useState<'google' | 'apple' | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading('google');
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message);
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
        Alert.alert('Sign In Failed', error.message);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoHere}>HERE</Text>
          <Text style={styles.logoToo}>Too</Text>
        </View>
        <Text style={styles.tagline}>Where common ground lives</Text>
      </View>

      <View style={styles.description}>
        <Text style={styles.descText}>
          Post. Vote. Bridge. Watch your community find what it shares — not what divides it.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Continue with Google"
          onPress={handleGoogleLogin}
          loading={loading === 'google'}
          disabled={loading !== null}
          variant="primary"
          size="lg"
          style={styles.googleButton}
        />

        {Platform.OS === 'ios' && (
          <Button
            title="Continue with Apple"
            onPress={handleAppleLogin}
            loading={loading === 'apple'}
            disabled={loading !== null}
            variant="secondary"
            size="lg"
            style={styles.appleButton}
            textStyle={{ color: '#FFFFFF' }}
          />
        )}
      </View>

      <Text style={styles.terms}>
        By continuing, you agree to HereToo's Terms of Service and Privacy Policy
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  logoHere: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 48,
    color: Colors.brandIvory,
  },
  logoToo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 48,
    color: Colors.brandGold,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  description: {
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  descText: {
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
  },
  buttons: {
    gap: 16,
    marginBottom: 32,
  },
  googleButton: {
    width: '100%',
  },
  appleButton: {
    width: '100%',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  terms: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
