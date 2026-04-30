/**
 * Founding-seed landing page — `/sow/<TOKEN>`.
 *
 * Sponsor (someone already on HereToo) sent the recipient this link
 * to "plant a tree" with them — i.e. start their OWN family on
 * HereToo while being connected to the sponsor.
 *
 * Flow:
 *   1. Anon-readable preview of the sponsor + their note (via the
 *      find_seed_invite RPC from migration 013)
 *   2. If the recipient isn't signed in: inline express signup.
 *      `pending_seed_token` is stashed in localStorage so the welcome
 *      page can resume here after auth.
 *   3. If signed in: prompt for the family name (pre-filled with the
 *      sponsor's suggestion if any) and call accept_seed_invite. The
 *      RPC creates the new family with the recipient as owner AND a
 *      connections row so the two trees see each other.
 *   4. Redirect to the new family page.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { useSeedInvite, useAcceptSeedInvite } from '../../hooks/useSeedInvite';
import { StatureAvatar } from '../../components/shared/StatureAvatar';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const PENDING_KEY = 'heretoo:pending_seed_token';

export default function SowPlant() {
  const s = makeStyles();
  const { token } = useLocalSearchParams<{ token: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const tk = (token ?? '').trim();

  const { data: invite, isLoading: loading } = useSeedInvite(tk || null);
  const accept = useAcceptSeedInvite();

  const [familyName, setFamilyName] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'auth' | 'plant' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Pre-fill the family name with the sponsor's suggestion when it loads.
  useEffect(() => {
    if (invite?.suggested_family_name && !familyName) {
      setFamilyName(invite.suggested_family_name);
    }
  }, [invite?.suggested_family_name, familyName]);

  // Stash the token for post-auth resume if the visitor is signed-out.
  useEffect(() => {
    if (!userId && tk) {
      try { localStorage.setItem(PENDING_KEY, tk); } catch {}
    }
  }, [userId, tk]);

  const planted = () => {
    try { localStorage.removeItem(PENDING_KEY); } catch {}
  };

  const onPlant = async () => {
    setErr(null);
    if (!tk) return;
    if (familyName.trim().length < 2) {
      setErr('Pick a family name with at least 2 characters.');
      return;
    }
    setBusy('plant');
    try {
      const { family_id } = await accept.mutateAsync({ token: tk, familyName: familyName.trim() });
      planted();
      router.replace(`/family/${family_id}` as any);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not plant your tree.');
    } finally {
      setBusy(null);
    }
  };

  const submitAuth = async () => {
    setErr(null);
    if (!email.trim() || password.length < 6) {
      setErr('Email and a 6+ character password required.');
      return;
    }
    setBusy('auth');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
        });
        if (error) throw error;
        if (!data.session) {
          setErr('Check your email to confirm your account, then come back to this link.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (error) throw error;
      }
      // Tiny delay so authStore picks up the new session before we plant.
      await new Promise((r) => setTimeout(r, 200));
      await onPlant();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not authenticate.');
    } finally {
      setBusy(null);
    }
  };

  // ── render ──
  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!invite) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.card}>
          <Ionicons name="leaf-outline" size={36} color={Colors.textMuted} />
          <Text style={s.title}>Seed not found</Text>
          <Text style={s.sub}>
            That invite is invalid or has expired. Ask whoever sent it
            for a fresh one.
          </Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={s.ctaText}>Go to HereToo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (invite.used) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.card}>
          <Ionicons name="checkmark-done" size={36} color={Colors.success} />
          <Text style={s.title}>Seed already planted</Text>
          <Text style={s.sub}>This invite has already been used.</Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={s.ctaText}>Go to HereToo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (invite.expired) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.card}>
          <Ionicons name="time-outline" size={36} color={Colors.textMuted} />
          <Text style={s.title}>Seed expired</Text>
          <Text style={s.sub}>Ask the person who sent it for a new link.</Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={s.ctaText}>Go to HereToo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <StatureAvatar
                profileId={invite.sponsor_id}
                name={invite.sponsor_display_name}
                photoUrl={invite.sponsor_avatar_path ? mediaPathToUrl(invite.sponsor_avatar_path) : null}
                size={64}
                hideMeta
              />
              <Text style={s.eyebrow}>A seed from</Text>
              <Text style={s.sponsor}>
                {invite.sponsor_display_name ?? `@${invite.sponsor_handle ?? 'someone'}`}
              </Text>
            </View>

            {!!invite.message && (
              <View style={s.messageBox}>
                <Text style={s.message}>"{invite.message}"</Text>
              </View>
            )}

            <Text style={s.headline}>Plant your family tree</Text>
            <Text style={s.sub}>
              Pick a name for your family circle. You'll be the matriarch
              or patriarch — invite people in as you go. We'll connect you
              with {invite.sponsor_display_name ?? '@' + (invite.sponsor_handle ?? 'them')}{' '}
              automatically.
            </Text>

            <Field label="Your family's name">
              <TextInput
                style={s.input}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="The Garcías"
                placeholderTextColor={Colors.textMuted}
                maxLength={60}
                returnKeyType={userId ? 'go' : 'next'}
                onSubmitEditing={userId ? onPlant : undefined}
              />
            </Field>

            {!!err && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{err}</Text>
              </View>
            )}

            {userId ? (
              <TouchableOpacity
                style={[s.cta, busy === 'plant' && { opacity: 0.5 }]}
                onPress={onPlant}
                disabled={busy === 'plant'}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>{busy === 'plant' ? 'Planting…' : 'Plant my tree'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={s.modeRow}>
                  <TouchableOpacity
                    onPress={() => setMode('signup')}
                    style={[s.modeTab, mode === 'signup' && s.modeTabActive]}
                  >
                    <Text style={[s.modeText, mode === 'signup' && s.modeTextActive]}>New here</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setMode('signin')}
                    style={[s.modeTab, mode === 'signin' && s.modeTabActive]}
                  >
                    <Text style={[s.modeText, mode === 'signin' && s.modeTextActive]}>I have an account</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'Choose a password (6+)' : 'Password'}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={submitAuth}
                />
                <TouchableOpacity
                  style={[s.cta, busy && { opacity: 0.5 }]}
                  onPress={submitAuth}
                  disabled={!!busy}
                  activeOpacity={0.85}
                >
                  <Text style={s.ctaText}>
                    {busy === 'auth' ? 'Setting up your account…' :
                     busy === 'plant' ? 'Planting your tree…' :
                     mode === 'signup' ? 'Create account & plant tree' : 'Sign in & plant tree'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  card: {
    margin: Spacing.lg, padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    gap: 12, maxWidth: 480, alignSelf: 'center', width: '100%',
  },
  eyebrow: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  sponsor: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  messageBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, padding: 12,
  },
  message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },

  headline: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  sub: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },

  modeRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.surfaceLight, borderRadius: 999, padding: 4,
  },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  modeTabActive: { backgroundColor: Colors.surface },
  modeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  modeTextActive: { color: Colors.textPrimary },

  cta: {
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 999, backgroundColor: Colors.primary,
    alignSelf: 'stretch', alignItems: 'center', marginTop: 4,
  },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },

  errorBox: {
    backgroundColor: 'rgba(255,64,80,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,64,80,0.30)',
    borderRadius: Radius.md, padding: 10,
  },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' },
}); }
