/**
 * Shareable family-invite landing page.
 *
 * URL: https://heretoo.social/join/<CODE>
 *
 * Flow:
 *   1. Look up the family by invite_code (RLS opened in migration 004).
 *   2. If signed-out → show a "Sign in to accept" CTA. Stash the invite
 *      code in localStorage so the welcome screen can resume the flow
 *      after auth and route the user back here.
 *   3. If signed-in but already a member → show that and link into the
 *      family page.
 *   4. If signed-in and not a member → show family preview + "Accept
 *      invite" button. On accept, insert the family_member row and
 *      redirect to /family/<id>.
 *
 * Why this shape: a single canonical URL works for SMS, email, group
 * chats, social sharing — copy it once, send it anywhere. No native app
 * required to receive it; the web flow signs them up just fine, and the
 * eventual native app can handle the same URL via deep-link routing.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const PENDING_KEY = 'heretoo:pending_invite_code';

export default function JoinByCode() {
  const s = makeStyles();
  const { code } = useLocalSearchParams<{ code: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const qc = useQueryClient();
  const normalized = (code ?? '').toUpperCase();

  // Look up family by invite code.
  const family = useQuery({
    queryKey: ['family-by-code', normalized],
    queryFn: async () => {
      if (!normalized) return null;
      const { data, error } = await supabase
        .from('families')
        .select('id, name, description, cover_path, invite_code')
        .eq('invite_code', normalized)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!normalized,
  });

  // Existing membership check.
  const member = useQuery({
    queryKey: ['my-membership', family.data?.id, userId],
    queryFn: async () => {
      if (!family.data?.id || !userId) return null;
      const { data, error } = await supabase
        .from('family_members')
        .select('id, status')
        .eq('family_id', family.data.id)
        .eq('profile_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!family.data?.id && !!userId,
  });

  const accept = useMutation({
    mutationFn: async () => {
      if (!family.data?.id || !userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('family_members')
        .insert({
          family_id: family.data.id,
          relationship_label: 'family',
          status: 'active',
          joined_at: new Date().toISOString(),
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['families'] });
      qc.invalidateQueries({ queryKey: ['my-membership'] });
      qc.invalidateQueries({ queryKey: ['network-stats'] });
      clearPendingInvite();
      if (family.data?.id) router.replace(`/family/${family.data.id}` as any);
    },
    onError: (e: any) => showAlert('Could not join', e?.message ?? 'Try again.'),
  });

  // If we landed here signed-out, stash the code so the welcome screen
  // can resume after auth.
  useEffect(() => {
    if (!userId && normalized) {
      try { localStorage.setItem(PENDING_KEY, normalized); } catch {}
    }
  }, [userId, normalized]);

  // Already a member? Bounce straight to the family page.
  useEffect(() => {
    if (member.data?.status === 'active' && family.data?.id) {
      clearPendingInvite();
      router.replace(`/family/${family.data.id}` as any);
    }
  }, [member.data, family.data]);

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
            That code is invalid or the family was deleted.
            Double-check the link, or ask whoever sent it for a fresh one.
          </Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)/feed')}>
            <Text style={s.ctaText}>Go to HereToo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const f = family.data;

  return (
    <SafeAreaView style={s.root}>
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

        {!userId ? (
          <>
            <TouchableOpacity
              style={s.cta}
              onPress={() => router.replace('/(auth)/welcome' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.ctaText}>Sign in to accept</Text>
            </TouchableOpacity>
            <Text style={s.fineprint}>
              New here? You can create an account on the next screen.
              We'll bring you right back to this invite.
            </Text>
          </>
        ) : (
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
        )}
      </View>
    </SafeAreaView>
  );
}

function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
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
  cta: {
    marginTop: 14, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 999, backgroundColor: Colors.primary,
    minWidth: 200, alignItems: 'center',
  },
  ctaText: { color: '#000', fontSize: 15, fontWeight: '700' },
  fineprint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
}); }
