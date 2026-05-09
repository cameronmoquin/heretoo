/**
 * /letter/claim/{token} — recipient-side claim of a future-recipient
 * letter. Source of Truth, Milestone 5.
 *
 * The author handed this URL to the recipient by some out-of-band
 * means. When the recipient opens it while signed in, the claim RPC
 * binds the letter_recipients row to their account. They are then
 * routed to /letter/{id} to read it.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClaimLetterToken } from '../../../hooks/useLetters';
import { useAuthStore } from '../../../stores/authStore';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function ClaimScreen() {
  const s = makeStyles();
  const { token } = useLocalSearchParams<{ token: string }>();
  const session = useAuthStore((st) => st.session);
  const claim = useClaimLetterToken();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !token) return;
    claim.mutate(token, {
      onSuccess: (letterId) => {
        router.replace(`/letter/${letterId}` as any);
      },
      onError: (e: any) => {
        setError(e?.message ?? 'Could not open this letter.');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, token]);

  if (!session) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.wrap}>
          <Text style={s.kicker}>A letter is waiting</Text>
          <Text style={s.title}>Sign in to open it</Text>
          <Text style={s.body}>
            Someone wrote you a letter on HereToo and chose today as the day
            to send it. Sign in or create an account, and it will appear in
            your inbox.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/welcome' as any)}
            style={s.cta}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>Step inside</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.wrap}>
          <Ionicons name="alert-circle-outline" size={28} color={Colors.textMuted} />
          <Text style={s.title}>This letter could not be opened</Text>
          <Text style={s.body}>{error}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/' as any)}
            style={s.cta}
            activeOpacity={0.85}
          >
            <Text style={s.ctaText}>Back to the Room</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.wrap}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={s.body}>Opening the letter…</Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  wrap: { padding: Spacing.xl, gap: Spacing.md },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 22, color: Colors.textSecondary },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    marginTop: Spacing.sm,
  },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
}); }
