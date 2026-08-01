/**
 * /letter — the user's letter inbox.
 *
 * Two sections: Received (delivered to me) and Drafts/Queued (mine).
 * Tapping any row opens the reader at /letter/{id}.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../../lib/nav';
import { Ionicons } from '@expo/vector-icons';
import { useReceivedLetters, useMyLetters, type LetterWithMeta } from '../../hooks/useLetters';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';

export default function LettersIndex() {
  const s = makeStyles();
  const { data: received } = useReceivedLetters();
  const { data: mine } = useMyLetters();
  const drafts = (mine ?? []).filter((l) => !l.delivered_at);
  const sent = (mine ?? []).filter((l) => !!l.delivered_at);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Letters</Text>
        <TouchableOpacity
          onPress={() => router.push('/letter/new' as any)}
          style={s.composeBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={14} color={Colors.onPrimary} />
          <Text style={s.composeBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {received && received.length > 0 && (
          <Section title="Received">
            {received.map((l) => <Row key={l.id} letter={l} variant="received" />)}
          </Section>
        )}

        {drafts.length > 0 && (
          <Section title="Queued">
            {drafts.map((l) => <Row key={l.id} letter={l} variant="queued" />)}
          </Section>
        )}

        {sent.length > 0 && (
          <Section title="Sent">
            {sent.map((l) => <Row key={l.id} letter={l} variant="sent" />)}
          </Section>
        )}

        {(received?.length ?? 0) === 0 && drafts.length === 0 && sent.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No letters yet.</Text>
            <Button
              title="Write one"
              onPress={() => router.push('/letter/new' as any)}
              variant="primary"
              size="sm"
              style={s.emptyBtn}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={{ gap: 4 }}>
      <Eyebrow style={s.sectionTitle}>{title}</Eyebrow>
      {children}
    </View>
  );
}

function Row({ letter, variant }: { letter: LetterWithMeta; variant: 'received' | 'queued' | 'sent' }) {
  const s = makeStyles();
  const meta =
    variant === 'received' ? `Delivered ${formatDate(letter.delivered_at!)}` :
    variant === 'queued' ? `Queued for ${formatDate(letter.deliver_at)}` :
    `Delivered ${formatDate(letter.delivered_at!)}`;
  const recipientLabel =
    variant === 'received'
      ? `From ${letter.author?.display_name || letter.author?.handle || 'someone'}`
      : `To ${(letter.recipients ?? []).map((r) => r.future_recipient_label || 'someone').join(', ') || 'someone'}`;
  const preview = (letter.body_plain || letter.body_md).slice(0, 120).trim();
  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => router.push(`/letter/${letter.id}` as any)}
      activeOpacity={0.75}
    >
      <Text style={s.rowMeta}>{meta}</Text>
      <Text style={s.rowTo}>{recipientLabel}</Text>
      <Text style={s.rowPreview} numberOfLines={2}>{preview}{preview.length === 120 ? '…' : ''}</Text>
    </TouchableOpacity>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  headerTitle: {
    flex: 1, fontSize: Type.ui.size, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  // Left as a hand-rolled pill: Button floors at a 44pt touch target,
  // which would nearly double this header row's height.
  composeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: Spacing.sm, paddingVertical: 7,
    borderRadius: Radius.full, backgroundColor: Colors.primary,
  },
  composeBtnText: { color: Colors.onPrimary, fontSize: Type.caption.size, fontWeight: '700' },

  scroll: { padding: Spacing.md, gap: Spacing.lg, paddingBottom: 80 },

  // Type / color / tracking come from the shared Eyebrow.
  sectionTitle: { marginBottom: 6 },

  row: {
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: Spacing.xxs,
    marginBottom: 6,
  },
  // 10px sits below the Type scale; Eyebrow would bump it to 11 inside a
  // dense list row, so this stays hand-set.
  rowMeta: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  rowTo: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  rowPreview: {
    fontSize: 13, lineHeight: 19, color: Colors.textSecondary,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif' } as any)
      : {}),
  },

  emptyWrap: { padding: Spacing.xl, gap: Spacing.xs, alignItems: 'flex-start' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  // Button supplies the fill, the ink and the 44pt floor.
  emptyBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.full },
}); }
