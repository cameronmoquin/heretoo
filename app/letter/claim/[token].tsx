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
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClaimLetterToken } from '../../../hooks/useLetters';
import { useAuthStore } from '../../../stores/authStore';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { Button } from '../../../components/shared/Button';
import { Eyebrow } from '../../../components/shared/Eyebrow';

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
          <Eyebrow>A letter is waiting</Eyebrow>
          <Text style={s.title}>Sign in to open it</Text>
          <Text style={s.body}>
            Someone wrote you a letter on HereToo and chose today as the day
            to send it. Sign in or create an account, and it will appear in
            your inbox.
          </Text>
          <Button
            title="Step inside"
            onPress={() => router.replace('/(auth)/welcome' as any)}
            variant="primary"
            size="sm"
            style={s.cta}
          />
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
          <Button
            title="Back to the Room"
            onPress={() => router.replace('/' as any)}
            variant="primary"
            size="sm"
            style={s.cta}
          />
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
  title: { fontSize: Type.display.size, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  body: { fontSize: Type.ui.size, lineHeight: 22, color: Colors.textSecondary },
  // Button supplies the fill, the ink and the 44pt floor.
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
}); }
