/**
 * Letter reader / draft view.
 *
 * Source of Truth, Milestone 5: full-bleed reader, Source Serif body
 * type, wallpaper at the edges, read-aloud in the corner. The reader
 * can heart the letter (private to author). No comments.
 *
 * If the letter has not been delivered yet AND the viewer is the
 * author, this view doubles as the draft inspector. Editable up
 * until 24h before deliver_at.
 */

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../lib/nav';
import { Ionicons } from '@expo/vector-icons';
import { useLetter, useMarkLetterRead, useDeleteLetter } from '../../hooks/useLetters';
import { useAuthStore } from '../../stores/authStore';
import { useTTS } from '../../stores/ttsStore';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';

export default function LetterScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const { data: letter, isLoading } = useLetter(id);
  const markRead = useMarkLetterRead();
  const del = useDeleteLetter();
  const tts = useTTS();

  // Mark read when a recipient opens an arrived letter.
  useEffect(() => {
    if (!letter || !userId || !letter.delivered_at) return;
    const isRecipient = (letter.recipients ?? []).some((r) => r.user_id === userId);
    if (isRecipient) markRead.mutate(letter.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id, letter?.delivered_at, userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!letter) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={s.empty}>Letter not found.</Text>
      </SafeAreaView>
    );
  }

  const isAuthor = userId === letter.author_id;
  const isDelivered = !!letter.delivered_at;
  const ttsActive = tts.currentId === letter.id && tts.playing;

  const onReadAloud = () => {
    const t = letter.body_plain || letter.body_md;
    if (t) tts.toggle(letter.id, t);
  };

  const onDelete = () => {
    showConfirm(
      'Delete this letter?',
      "If you've shared the claim URL with someone, they won't be able to open it.",
      () => del.mutate(letter.id, {
        onSuccess: () => router.replace('/letter' as any),
        onError: (e: any) => showAlert('Could not delete', e?.message ?? 'Try again.'),
      }),
      'Delete', 'Cancel',
    );
  };

  const dateline = isDelivered
    ? `Written ${formatDate(letter.created_at)}, delivered ${formatDate(letter.delivered_at!)}`
    : `Queued for ${formatDate(letter.deliver_at)}`;

  const futureRecipients = (letter.recipients ?? []).filter((r) => !r.user_id && r.future_recipient_label);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onReadAloud} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={ttsActive ? 'pause' : 'volume-medium-outline'}
            size={18}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
        {isAuthor && !isDelivered && (
          <TouchableOpacity onPress={onDelete} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Eyebrow>{dateline}</Eyebrow>

        {!!letter.author && (
          <Text style={s.from}>From {letter.author.display_name || letter.author.handle || 'a friend'}</Text>
        )}

        <Text style={s.body}>{letter.body_md}</Text>

        {/* Future-recipient claim section, only shown to the author */}
        {isAuthor && futureRecipients.length > 0 && (
          <View style={s.claims}>
            <Text style={s.claimsTitle}>Claim URLs</Text>
            {futureRecipients.map((r) => (
              <View key={r.id} style={s.claimRow}>
                <Text style={s.claimLabel}>{r.future_recipient_label}</Text>
                <Text selectable style={s.claimUrl} numberOfLines={1}>
                  {`${typeof window !== 'undefined' ? window.location.origin : 'https://heretoo.social'}/letter/claim/${r.future_recipient_token}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  backBtn: { padding: Spacing.xxs },
  iconBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.md },

  from: {
    fontSize: Type.ui.size, fontWeight: '600', color: Colors.textSecondary,
  },
  body: {
    fontSize: 18, lineHeight: 30,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },

  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },

  claims: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  // Sentence-case bold label, not an uppercase kicker — Eyebrow would
  // recase the copy.
  claimsTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  claimRow: { gap: 2 },
  claimLabel: { fontSize: Type.caption.size, fontWeight: '600', color: Colors.textPrimary },
  claimUrl: {
    fontSize: 11, color: Colors.textSecondary,
    fontFamily: Platform.OS === 'web' ? ('ui-monospace, SFMono-Regular, monospace' as any) : 'monospace',
  },
}); }
