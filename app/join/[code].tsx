/**
 * Shareable crew-invite landing page.
 *
 * Anyone can land here. Signed in, signed out, never been on the site
 * before. The whole flow happens on a single screen so a non-technical
 * recipient (your aunt, your brother) just enters an email and a
 * password, taps Accept, and is in the crew within ten seconds.
 *
 * DB identifiers below still say "family" on purpose. Display copy says
 * "crew" and comes from constants/vocab.
 *
 * Crew preview is fetched via the SECURITY DEFINER RPC
 * `find_family_by_invite_code` (migration 008) so anon visitors can
 * see what they're joining without RLS blocking them.
 *
 * Express signup auto-generates a handle from the email's local-part
 * (the `handle_new_user` trigger handles uniqueness and fallback).
 * The user never has to pick one up-front.
 *
 * URL: https://heretoo.social/join/<CODE>
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

interface FamilyPreview {
  id: string;
  name: string;
  description: string | null;
  cover_path: string | null;
}

export default function JoinByCode() {
  const s = makeStyles();
  const { code } = useLocalSearchParams<{ code: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const qc = useQueryClient();
  const normalized = (code ?? '').toUpperCase().trim();

  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'auth' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Crew preview via anon-callable RPC.
  const family = useQuery({
    queryKey: ['family-preview', normalized],
    queryFn: async (): Promise<FamilyPreview | null> => {
      if (!normalized) return null;
      const { data, error: e } = await supabase.rpc('find_family_by_invite_code', {
        code: normalized,
      });
      if (e) throw e;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as FamilyPreview | null;
    },
    enabled: !!normalized,
  });

  // Accept-invite goes through a SECURITY DEFINER RPC instead of a
  // direct family_members insert. The direct insert was hitting the
  // RLS policy that requires the inserter to be either the family
  // owner or responding to a pre-existing pending invite — neither
  // of which a brand-new joiner is. Migration 012 added
  // `accept_family_invite(invite_code, relationship_label)` which
  // validates the code server-side and inserts with elevated
  // privileges. Idempotent: existing rows get reactivated.
  const accept = useMutation({
    mutationFn: async () => {
      if (!normalized) throw new Error('Invite not loaded');
      const { error: e } = await supabase.rpc('accept_family_invite', {
        invite_code_in: normalized,
        relationship_label_in: Vocab.member,
      });
      if (e) throw e;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['network-stats'] });
      if (family.data?.id) router.replace(`/family/${family.data.id}` as any);
    },
    onError: (e: any) => setError(e?.message ?? 'Could not join.'),
  });

  // Already signed in? Skip the form, go straight to Accept.
  useEffect(() => {
    if (userId && family.data?.id) {
      // Don't auto-join — let them confirm. But hide the auth form.
    }
  }, [userId, family.data?.id]);

  const submitAuth = async () => {
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError('Email and a 6+ character password required.');
      return;
    }
    if (!family.data?.id) {
      setError('This invite is not loaded yet.');
      return;
    }
    setBusy('auth');
    try {
      if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (e) throw e;
        if (!data.session) {
          // Email confirmation required — tell them.
          setError('Check your email to confirm your account, then come back to this link.');
          return;
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e) throw e;
      }
      setBusy('join');
      // Tiny delay so authStore picks up the new session before insert RLS fires.
      await new Promise((r) => setTimeout(r, 200));
      await accept.mutateAsync();
    } catch (e: any) {
      setError(e?.message ?? 'Could not authenticate.');
    } finally {
      setBusy(null);
    }
  };

  // ── render ──
  if (family.isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!family.data) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.card}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.textMuted} />
          <Text style={s.title}>Invite not found</Text>
          <Text style={s.sub}>
            That code is dead, or the {Vocab.group} was deleted.
            Check the link. Or ask whoever sent it for a fresh one.
          </Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={s.ctaText}>Go to HereToo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const f = family.data;

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            {f.cover_path ? (
              <Image source={{ uri: mediaPathToUrl(f.cover_path) }} style={s.cover} />
            ) : (
              <View style={[s.cover, s.coverFallback]}>
                <Ionicons name="people" size={36} color={Colors.primary} />
              </View>
            )}

            <Text style={s.eyebrow}>You're invited to join</Text>
            <Text style={s.familyName}>{f.name}</Text>
            {!!f.description && <Text style={s.sub}>{f.description}</Text>}

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {userId ? (
              // Signed in already — single-tap accept.
              <TouchableOpacity
                style={[s.cta, accept.isPending && { opacity: 0.5 }]}
                onPress={() => accept.mutate()}
                disabled={accept.isPending}
                activeOpacity={0.85}
              >
                <Text style={s.ctaText}>
                  {accept.isPending ? 'Joining…' : 'Accept invite'}
                </Text>
              </TouchableOpacity>
            ) : (
              // Signed out — express signup right here.
              <View style={s.formWrap}>
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
                  autoComplete="email"
                  returnKeyType="next"
                />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'Choose a password (6+)' : 'Password'}
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
                     busy === 'join' ? `Joining the ${Vocab.group}…` :
                     mode === 'signup' ? `Join ${f.name}` : 'Sign in & accept'}
                  </Text>
                </TouchableOpacity>

                <Text style={s.fineprint}>
                  {mode === 'signup'
                    ? "We'll pick a username for you from your email. You can change it later in your profile."
                    : "Use the email and password you signed up with."}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  card: {
    margin: Spacing.lg, padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: 10,
    maxWidth: 480, alignSelf: 'center', width: '100%',
  },
  cover: {
    width: '100%', aspectRatio: 16 / 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceLight,
  },
  coverFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6, marginTop: 8,
  },
  familyName: {
    fontSize: 26, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  sub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  formWrap: { width: '100%', gap: 10, marginTop: 12 },
  modeRow: {
    flexDirection: 'row', gap: 6,
    backgroundColor: Colors.surfaceLight, borderRadius: 999, padding: 4,
  },
  modeTab: {
    flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center',
  },
  modeTabActive: { backgroundColor: Colors.surface },
  modeText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  modeTextActive: { color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },

  cta: {
    marginTop: 6, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 999, backgroundColor: Colors.primary,
    minWidth: 200, alignItems: 'center', alignSelf: 'stretch',
  },
  ctaText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  fineprint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  errorBox: {
    width: '100%', backgroundColor: 'rgba(255,64,80,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,64,80,0.30)',
    borderRadius: Radius.md, padding: 10,
  },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center' },
}); }
