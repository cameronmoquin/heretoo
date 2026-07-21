/**
 * /reset-password — the landing screen for a Supabase password
 * recovery email.
 *
 * Before this screen existed the recovery email pointed at /welcome,
 * which is the sign-in form. The token rode in on the URL and nothing
 * consumed it, so the user could never set a new password. This screen
 * consumes the token, then takes the new password.
 *
 * Supabase JS v2 hands the token over in one of three shapes depending
 * on the project's flow type and on which mail template is in use:
 *
 *   1. Implicit flow (the v2 default):
 *        /reset-password#access_token=...&refresh_token=...&type=recovery
 *      → supabase.auth.setSession({ access_token, refresh_token })
 *
 *   2. PKCE flow:
 *        /reset-password?code=...
 *      → supabase.auth.exchangeCodeForSession(code)
 *
 *   3. Custom mail template using {{ .TokenHash }}:
 *        /reset-password?token_hash=...&type=recovery
 *      → supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
 *
 * All three are handled. We also subscribe to onAuthStateChange for the
 * PASSWORD_RECOVERY event, because a client configured with
 * detectSessionInUrl: true can swallow the fragment before this effect
 * runs, which leaves the URL empty and the session already live.
 *
 * lib/supabase.ts currently sets detectSessionInUrl: false, so the
 * explicit path below is the one that fires today. The listener is the
 * belt to that suspenders, and it keeps working if that flag flips.
 *
 * Once a session is established the token is stripped from the address
 * bar with history.replaceState so it stays out of the browser history,
 * out of screenshots, and out of any outbound Referer header.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform,
  TouchableOpacity, KeyboardAvoidingView, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Button } from '../components/shared/Button';
import { HereTooLogo } from '../components/shared/Logo';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Heights } from '../constants/design';

type Phase = 'checking' | 'ready' | 'done' | 'invalid';

const EXPIRED_COPY =
  'This link expired or it was already used. Reset links last one hour and work one time. Request a new one from the sign-in screen.';

export default function ResetPasswordScreen() {
  const s = makeStyles();
  const params = useLocalSearchParams<{
    code?: string; token_hash?: string; type?: string;
    error?: string; error_description?: string;
  }>();

  const [phase, setPhase] = useState<Phase>('checking');
  const [fatalMsg, setFatalMsg] = useState<string>(EXPIRED_COPY);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guards the two racing paths (the auth listener and the explicit
  // token exchange) so the first one to land wins and the second is
  // a no-op.
  const settled = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    // Snapshot the URL before anything is allowed to clear it. succeed()
    // wipes the address bar, and succeed() can be triggered by the auth
    // listener below, so the read has to happen first and synchronously.
    const hash = readHashParams();
    const query = readQueryParams(params);

    const succeed = () => {
      if (!mounted || settled.current) return;
      settled.current = true;
      clearAuthParamsFromUrl();
      setPhase('ready');
    };

    const fail = (msg: string) => {
      if (!mounted || settled.current) return;
      settled.current = true;
      clearAuthParamsFromUrl();
      setFatalMsg(msg);
      setPhase('invalid');
    };

    // The client may consume the fragment on its own before the async
    // block below gets a turn. PASSWORD_RECOVERY is the event that
    // fires when it does.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && !!session)) succeed();
    });

    (async () => {
      // Supabase reports a dead or tampered link by putting the reason
      // in the URL rather than by failing the exchange.
      const urlError =
        hash.error_description || hash.error || query.error_description || query.error;
      if (urlError) {
        fail(prettify(urlError));
        return;
      }

      try {
        // 1. Implicit flow. Tokens arrive in the hash fragment.
        if (hash.access_token && hash.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: hash.access_token,
            refresh_token: hash.refresh_token,
          });
          if (error) throw error;
          succeed();
          return;
        }

        // 2. PKCE flow.
        if (query.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(query.code);
          if (error) throw error;
          succeed();
          return;
        }

        // 3. Custom template with {{ .TokenHash }}.
        const tokenHash = query.token_hash || hash.token_hash;
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) throw error;
          succeed();
          return;
        }

        // Nothing in the URL. Either the client already consumed it or
        // the user is signed in and walked here directly. Both are fine.
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          succeed();
          return;
        }
        fail(EXPIRED_COPY);
      } catch (err: any) {
        fail(err?.message ? prettify(err.message) : EXPIRED_COPY);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // Runs once. The URL is read imperatively inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const save = async () => {
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Both password fields must match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPhase('done');
      redirectTimer.current = setTimeout(() => {
        router.replace('/(tabs)/feed' as any);
      }, 1400);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      // A session that died between load and submit is a dead link, so
      // send the user down the recovery path instead of leaving them on
      // a form that will keep failing.
      if (/session|jwt|expired|invalid token|not authenticated/i.test(msg)) {
        settled.current = true;
        setFatalMsg(EXPIRED_COPY);
        setPhase('invalid');
        return;
      }
      setErrorMsg(msg || 'Could not save the new password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const backToSignIn = () => router.replace('/(auth)/welcome' as any);
  const goToFeed = () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    router.replace('/(tabs)/feed' as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoArea}>
            <HereTooLogo size={56} color="#FFFFFF" />
            <Text style={s.logoSub}>heretoo</Text>
          </View>

          {phase === 'checking' && (
            <View style={s.section}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={s.statusText}>Checking your link.</Text>
            </View>
          )}

          {phase === 'ready' && (
            <View style={s.section}>
              <Text style={s.title}>Set a new password</Text>
              <Text style={s.subtitle}>
                Make it long. Keep it somewhere only you can reach.
              </Text>

              <Text style={s.fieldLabel}>New password</Text>
              <TextInput
                style={s.input}
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules="minlength: 8;"
              />

              <Text style={s.fieldLabel}>Confirm password</Text>
              <TextInput
                style={s.input}
                placeholder="Type it again"
                placeholderTextColor={Colors.textMuted}
                value={confirm}
                onChangeText={(t) => { setConfirm(t); setErrorMsg(null); }}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={save}
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules="minlength: 8;"
              />

              <TouchableOpacity
                onPress={() => setReveal((v) => !v)}
                style={s.revealBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.revealText}>{reveal ? 'Hide password' : 'Show password'}</Text>
              </TouchableOpacity>

              {errorMsg && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{errorMsg}</Text>
                </View>
              )}

              <Button
                title={loading ? 'Saving…' : 'Save password'}
                onPress={save}
                loading={loading}
                disabled={loading || !password || !confirm}
                variant="primary"
                size="lg"
                style={s.submitBtn}
              />

              <TouchableOpacity onPress={backToSignIn} style={s.linkBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.linkText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'done' && (
            <View style={s.section}>
              <Text style={s.title}>Password changed</Text>
              <Text style={s.subtitle}>
                The new one is live. Taking you to the feed.
              </Text>
              <Button
                title="Go to the feed"
                onPress={goToFeed}
                variant="primary"
                size="lg"
                style={s.submitBtn}
              />
            </View>
          )}

          {phase === 'invalid' && (
            <View style={s.section}>
              <Text style={s.title}>This link expired</Text>
              <Text style={s.subtitle}>{fatalMsg}</Text>
              <Text style={s.fieldHint}>
                Open the sign-in screen, type your email, then tap "Forgot password". A fresh
                link lands in your inbox within a minute.
              </Text>
              <Button
                title="Back to sign in"
                onPress={backToSignIn}
                variant="primary"
                size="lg"
                style={s.submitBtn}
              />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Read the hash fragment as a flat map. Web only. Native deep links
 *  surface their params through useLocalSearchParams instead. */
function readHashParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = (window.location.hash || '').replace(/^#/, '');
  if (!raw) return {};
  const out: Record<string, string> = {};
  try {
    new URLSearchParams(raw).forEach((v, k) => { out[k] = v; });
  } catch {}
  return out;
}

/** Query params, preferring the live URL on web and falling back to the
 *  router's parsed params so native deep links work too. */
function readQueryParams(routerParams: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(routerParams ?? {})) {
    if (typeof v === 'string' && v) out[k] = v;
  }
  if (typeof window !== 'undefined') {
    try {
      new URLSearchParams(window.location.search || '').forEach((v, k) => { out[k] = v; });
    } catch {}
  }
  return out;
}

/** Strip the recovery token from the address bar once it is spent, so
 *  it stays out of history, screenshots, and the Referer header. */
function clearAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch {}
}

/** Supabase URL errors arrive form-encoded. Make them readable. */
function prettify(raw: string): string {
  try {
    return decodeURIComponent(String(raw).replace(/\+/g, ' '));
  } catch {
    return String(raw);
  }
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

  title: {
    fontSize: 22, fontWeight: '700', color: '#FFFFFF',
    letterSpacing: -0.3, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: '#A8A8BD', textAlign: 'center',
    lineHeight: 20, marginTop: 6,
  },
  statusText: {
    fontSize: 14, color: '#A8A8BD', textAlign: 'center', marginTop: 12,
  },

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
    // Thumb-sized target. Heights.input is 44.
    minHeight: Heights.input,
  },
  fieldHint: { fontSize: 11, color: '#888', marginTop: 8, lineHeight: 16, textAlign: 'center' },

  revealBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  revealText: { fontSize: 12, color: '#A8A8BD', fontWeight: '500' },

  linkBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 8, marginTop: 4 },
  linkText: { fontSize: 12, color: '#A8A8BD', fontWeight: '500' },

  submitBtn: { width: '100%', marginTop: 18 },

  errorBox: {
    backgroundColor: 'rgba(255, 0, 64, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 0, 64, 0.4)',
    borderRadius: Radius.md, padding: 12, marginTop: 8,
  },
  errorText: { color: '#FF6B6B', fontSize: 13, textAlign: 'center', lineHeight: 18 },
}); }
