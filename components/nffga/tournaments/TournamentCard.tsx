/**
 * TournamentCard — one tournament in a list: name, date, course, format,
 * entry fee, spots left. Opens the full sheet.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { formatMoney, type Tournament } from '../../../lib/nffga/types';
import {
  FORMAT_LABEL, STATUS_LABEL, courseCityState, formatDay, formatTime, spotsLeft,
} from '../../../lib/nffga/tournaments';

export function TournamentCard({ t, compact }: { t: Tournament; compact?: boolean }) {
  const s = makeStyles();
  const place = [t.course_name, courseCityState(t)].filter(Boolean).join(' · ');
  const left = spotsLeft(t);
  const fee = t.entry_fee_cents > 0 ? formatMoney(t.entry_fee_cents, t.currency) : 'No entry fee';
  const facts = [
    FORMAT_LABEL[t.format] ?? t.format,
    fee,
    left == null ? null : left === 0 ? (t.waitlist_enabled ? 'Full, waitlist open' : 'Full') : `${left} ${left === 1 ? 'spot' : 'spots'} left`,
  ].filter(Boolean).join(' · ');
  const when = t.starts_at
    ? `${formatDay(t.starts_at, t.timezone)}${compact ? '' : ` · ${formatTime(t.starts_at, t.timezone)}`}`
    : 'Date to be announced';

  return (
    <Pressable
      onPress={() => router.push(`/tournaments/${t.id}` as any)}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
      accessibilityRole="link"
      accessibilityLabel={t.name}
    >
      <View style={s.top}>
        <Text style={s.when}>{when}</Text>
        {t.status !== 'registration_open' ? <Text style={s.status}>{STATUS_LABEL[t.status]}</Text> : null}
      </View>
      <Text style={s.name} numberOfLines={2}>{t.name}</Text>
      {place ? <Text style={s.place} numberOfLines={1}>{place}</Text> : null}
      <Text style={s.facts} numberOfLines={compact ? 1 : 2}>{facts}</Text>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media,
    padding: Spacing.md, gap: Spacing.xxs, backgroundColor: Colors.surface,
  },
  pressed: { backgroundColor: Colors.surfaceAlt },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.xs, flexWrap: 'wrap' },
  when: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, fontWeight: '600', color: Colors.textSecondary },
  status: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
  name: { fontSize: Type.title.size - 2, lineHeight: Type.title.lineHeight - 2, fontWeight: '700', color: Colors.textPrimary },
  place: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  facts: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
}); }
