/**
 * EventRequestsPanel — the site admins' queue of host-department event
 * requests (nffga_event_requests, migration 107), shown in the back
 * office at /admin → Requests. Since migration 110 only site admins
 * (super / managing admin) may read all requests or decide them.
 *
 * Approve → nffga_create_tournament_from_request makes a draft
 * tournament prefilled from the request, then opens its edit page.
 * Decline asks for a note, which the submitter can read.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { EventRequest } from '../../../lib/nffga/types';
import {
  EVENT_REQUEST_STATUS_LABEL, FORMAT_LABEL, approveEventRequest, eventRequestKeys, setEventRequestStatus,
  tournamentKeys, useAllEventRequests,
} from '../../../lib/nffga/tournaments';
import { ErrorText, Loading, Muted, TextField } from '../tournaments/ui';

export function EventRequestsPanel() {
  const s = makeStyles();
  const q = useAllEventRequests(true);
  const [showDecided, setShowDecided] = useState(false);
  const rows = q.data ?? [];
  const open = rows.filter((r) => r.status === 'submitted' || r.status === 'reviewing');
  const decided = rows.filter((r) => r.status === 'approved' || r.status === 'declined');

  return (
    <View style={s.group}>
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">{`Requests${open.length ? ` (${open.length})` : ''}`}</Text>
        {decided.length > 0 ? (
          <Pressable onPress={() => setShowDecided((v) => !v)} accessibilityRole="button" style={s.toggle}>
            <Text style={s.toggleText}>{showDecided ? 'Hide decided' : `Show decided (${decided.length})`}</Text>
          </Pressable>
        ) : null}
      </View>
      <Muted>Event proposals from host departments. Approving one creates a draft tournament and opens it for editing.</Muted>
      {q.isLoading ? <Loading /> : open.length === 0 && !showDecided ? <Muted>No open requests.</Muted> : null}
      {open.map((r) => <RequestCard key={r.id} r={r} />)}
      {showDecided ? decided.map((r) => <RequestCard key={r.id} r={r} />) : null}
    </View>
  );
}

function RequestCard({ r }: { r: EventRequest }) {
  const s = makeStyles();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'approve' | 'decline' | 'review' | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState(r.officer_notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const decided = r.status === 'approved' || r.status === 'declined';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: eventRequestKeys.all });
    qc.invalidateQueries({ queryKey: tournamentKeys.all });
  };

  async function approve() {
    setErr(null); setBusy('approve');
    const res = await approveEventRequest(r.id);
    setBusy(null);
    if (!res.ok) { setErr(res.error); return; }
    refresh();
    router.push(`/tournaments/${res.tournamentId}/edit` as any);
  }

  async function decline() {
    setErr(null);
    if (!note.trim()) { setErr('Add a short note for the department.'); return; }
    setBusy('decline');
    const res = await setEventRequestStatus(r.id, 'declined', note.trim());
    setBusy(null);
    if (!res.ok) { setErr(res.error ?? 'Could not decline.'); return; }
    setDeclining(false);
    refresh();
  }

  async function markReviewing() {
    setErr(null); setBusy('review');
    const res = await setEventRequestStatus(r.id, 'reviewing');
    setBusy(null);
    if (!res.ok) { setErr(res.error ?? 'Could not update.'); return; }
    refresh();
  }

  const where = [r.city, r.state].filter(Boolean).join(', ');
  const course = [r.course_name, r.course_city].filter(Boolean).join(', ');
  const fmt = r.format ? (FORMAT_LABEL as Record<string, string>)[r.format] ?? r.format : null;
  const lines: [string, string | null][] = [
    ['Contact', [r.contact_name, r.contact_email, r.contact_phone].filter(Boolean).join(' · ')],
    ['Area', [where, r.region].filter(Boolean).join(' · ') || null],
    ['Dates', r.proposed_dates],
    ['Course', course || null],
    ['Players', r.expected_players != null ? String(r.expected_players) : null],
    ['Format', fmt],
    ['Supports', r.beneficiary],
    ['Notes', r.notes],
    ['Note sent', r.officer_notes],
  ];

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.name}>{r.department_name}</Text>
        <Text style={s.status}>{EVENT_REQUEST_STATUS_LABEL[r.status]} · {new Date(r.created_at).toLocaleDateString()}</Text>
      </View>
      {lines.filter(([, v]) => v).map(([k, v]) => (
        <View key={k} style={s.line}>
          <Text style={s.lineLabel}>{k}</Text>
          {k === 'Contact' && r.contact_email ? (
            <Pressable onPress={() => Linking.openURL(`mailto:${r.contact_email}`).catch(() => {})} accessibilityRole="link" style={s.lineValueWrap}>
              <Text style={[s.lineValue, s.link]}>{v}</Text>
            </Pressable>
          ) : (
            <View style={s.lineValueWrap}><Text style={s.lineValue}>{v}</Text></View>
          )}
        </View>
      ))}

      {declining ? (
        <View style={s.declineBox}>
          <TextField label="Note to the department" value={note} onChangeText={setNote} multiline={3}
            help="The department sees this note with their request." />
        </View>
      ) : null}
      <ErrorText>{err}</ErrorText>

      <View style={s.actions}>
        {r.status === 'approved' && r.tournament_id ? (
          <Button title="Open tournament" onPress={() => router.push(`/tournaments/${r.tournament_id}/edit` as any)} variant="outline" size="sm" />
        ) : null}
        {!decided || r.status === 'declined' ? (
          declining ? (
            <>
              <Button title="Decline request" onPress={decline} variant="primary" size="sm" loading={busy === 'decline'} />
              <Button title="Cancel" onPress={() => { setDeclining(false); setErr(null); }} variant="ghost" size="sm" />
            </>
          ) : (
            <>
              <Button title="Approve and create draft" onPress={approve} variant="primary" size="sm" loading={busy === 'approve'} />
              {r.status !== 'declined' ? <Button title="Decline" onPress={() => setDeclining(true)} variant="outline" size="sm" /> : null}
              {r.status === 'submitted' ? <Button title="Mark under review" onPress={markReviewing} variant="ghost" size="sm" loading={busy === 'review'} /> : null}
            </>
          )
        ) : null}
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  group: { gap: Spacing.sm },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  title: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  toggle: { paddingVertical: Spacing.xxs },
  toggleText: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary, textDecorationLine: 'underline' },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media, padding: Spacing.md, gap: Spacing.xs, backgroundColor: Colors.surface },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.xs },
  name: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  status: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  line: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  lineLabel: { width: 110, fontSize: Type.ui.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  lineValueWrap: { flex: 1, minWidth: 180 },
  lineValue: { fontSize: Type.ui.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  link: { textDecorationLine: 'underline' },
  declineBox: { marginTop: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
}); }
