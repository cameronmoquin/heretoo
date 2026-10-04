/**
 * /tournaments/host — a fire department proposes a regional golf event
 * to be officiated by NFFGA. Anyone can read the page; sending a request
 * needs an account. Requests go to nffga_event_requests (migration 107);
 * the submitter sees their own requests and where each one stands, and
 * an officer's note when there is one.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { SITE_NAME } from '../../constants/site';
import type { TournamentFormat } from '../../lib/nffga/types';
import { useSession } from '../../lib/nffga/useSession';
import {
  EVENT_REQUEST_STATUS_LABEL, FORMAT_LABEL, TOURNAMENT_FORMATS, eventRequestKeys, fetchMyProfile,
  submitEventRequest, useMyEventRequests,
} from '../../lib/nffga/tournaments';
import {
  ChipPicker, ErrorText, FieldRow, FormSection, Loading, Muted, Notice, Page, PageTitle, Paragraph, TextField,
  blankToNull, toNumber,
} from '../../components/nffga/tournaments/ui';

export default function HostEventScreen() {
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Host an event' }} />
      <PageTitle title="Host an event" />
      <Paragraph>
        {`Fire departments can propose a regional golf event to be officiated by ${SITE_NAME}. Send the details below and an officer will review the request and follow up.`}
      </Paragraph>
      <RequireAccount reason="to submit an event">
        <HostForm />
        <MyRequests />
      </RequireAccount>
      <View><Button title="All tournaments" onPress={() => router.push('/tournaments' as any)} variant="ghost" size="md" /></View>
    </Page>
  );
}

const blank = (email: string | null) => ({
  department_name: '', contact_name: '', contact_email: email ?? '', contact_phone: '',
  city: '', state: '', region: '', proposed_dates: '', course_name: '', course_city: '',
  expected_players: '', format: null as TournamentFormat | null, beneficiary: '', notes: '',
});

function HostForm() {
  const s = makeStyles();
  const qc = useQueryClient();
  const { userId, email } = useSession();
  const [f, setF] = useState(() => blank(email));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!userId) return;
    let off = false;
    fetchMyProfile(userId).then((p) => {
      if (off || !p) return;
      setF((prev) => ({
        ...prev,
        contact_name: prev.contact_name || p.display_name || '',
        department_name: prev.department_name || p.department || '',
      }));
    });
    return () => { off = true; };
  }, [userId]);

  const players = toNumber(f.expected_players);
  const errors = {
    contact_email: f.contact_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim()) ? 'Enter a valid email' : null,
    expected_players: Number.isNaN(players) || (players != null && (!Number.isInteger(players) || players < 1 || players > 1000))
      ? 'Enter a whole number from 1 to 1000' : null,
  };

  async function submit() {
    setErr(null);
    if (f.department_name.trim().length < 2) { setErr('Enter the department name.'); return; }
    if (f.contact_name.trim().length < 2) { setErr('Enter a contact name.'); return; }
    if (!f.contact_email.trim()) { setErr('Enter a contact email.'); return; }
    if (errors.contact_email || errors.expected_players) { setErr('Fix the highlighted fields.'); return; }
    setBusy(true);
    const r = await submitEventRequest(userId as string, {
      department_name: f.department_name.trim(),
      contact_name: f.contact_name.trim(),
      contact_email: f.contact_email.trim(),
      contact_phone: blankToNull(f.contact_phone),
      city: blankToNull(f.city),
      state: blankToNull(f.state),
      region: blankToNull(f.region),
      proposed_dates: blankToNull(f.proposed_dates),
      course_name: blankToNull(f.course_name),
      course_city: blankToNull(f.course_city),
      expected_players: players as number | null,
      format: f.format,
      beneficiary: blankToNull(f.beneficiary),
      notes: blankToNull(f.notes),
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    qc.invalidateQueries({ queryKey: eventRequestKeys.mine(userId) });
    qc.invalidateQueries({ queryKey: eventRequestKeys.all });
    setSent(true);
    setF(blank(email));
  }

  if (sent) {
    return (
      <View style={s.stack}>
        <Notice>Request sent. Its status appears below.</Notice>
        <View style={s.actions}><Button title="Send another request" onPress={() => setSent(false)} variant="outline" size="md" /></View>
      </View>
    );
  }

  return (
    <View style={s.stack}>
      <FormSection title="Host department">
        <TextField label="Department" required value={f.department_name} onChangeText={set('department_name')} maxLength={140} autoCapitalize="words" />
        <FieldRow>
          <TextField label="City" value={f.city} onChangeText={set('city')} />
          <TextField label="State" value={f.state} onChangeText={set('state')} autoCapitalize="characters" maxLength={60} />
          <TextField label="Region" value={f.region} onChangeText={set('region')} placeholder="New England" />
        </FieldRow>
      </FormSection>

      <FormSection title="Contact">
        <TextField label="Name" required value={f.contact_name} onChangeText={set('contact_name')} autoCapitalize="words" maxLength={120} />
        <FieldRow>
          <TextField label="Email" required value={f.contact_email} onChangeText={set('contact_email')} keyboardType="email-address" autoCapitalize="none" error={errors.contact_email} />
          <TextField label="Phone" value={f.contact_phone} onChangeText={set('contact_phone')} keyboardType="phone-pad" maxLength={40} />
        </FieldRow>
        <Muted>Seen only by you and association officers.</Muted>
      </FormSection>

      <FormSection title="The event">
        <TextField label="Proposed dates" value={f.proposed_dates} onChangeText={set('proposed_dates')} placeholder="A Saturday in late May" maxLength={500} />
        <FieldRow>
          <TextField label="Course" value={f.course_name} onChangeText={set('course_name')} maxLength={140} />
          <TextField label="Course city" value={f.course_city} onChangeText={set('course_city')} maxLength={120} />
        </FieldRow>
        <TextField label="Expected players" value={f.expected_players} onChangeText={set('expected_players')} keyboardType="number-pad" error={errors.expected_players} />
        <ChipPicker label="Format" options={TOURNAMENT_FORMATS} value={f.format} onChange={set('format')} labels={FORMAT_LABEL} allowNone />
        <TextField label="Beneficiary" value={f.beneficiary} onChangeText={set('beneficiary')} help="Charity or fund the event would support." maxLength={300} />
        <TextField label="Anything else" value={f.notes} onChangeText={set('notes')} multiline={4} maxLength={4000} />
      </FormSection>

      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title="Send request" onPress={submit} variant="primary" size="lg" loading={busy} />
      </View>
    </View>
  );
}

function MyRequests() {
  const s = makeStyles();
  const { userId } = useSession();
  const q = useMyEventRequests(userId);
  if (q.isLoading) return <Loading />;
  const rows = q.data ?? [];
  if (rows.length === 0) return null;
  return (
    <View style={s.stack}>
      <Text style={s.title} accessibilityRole="header">Your requests</Text>
      {rows.map((r) => (
        <View key={r.id} style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.name}>{r.department_name}</Text>
            <Text style={s.status}>{EVENT_REQUEST_STATUS_LABEL[r.status]}</Text>
          </View>
          <Text style={s.sub}>
            {[r.proposed_dates, [r.course_name, r.course_city].filter(Boolean).join(', ') || null, `Sent ${new Date(r.created_at).toLocaleDateString()}`]
              .filter(Boolean).join(' · ')}
          </Text>
          {r.officer_notes ? <Text style={s.note}>{`Note from ${SITE_NAME}: ${r.officer_notes}`}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  stack: { gap: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  title: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media, padding: Spacing.md, gap: Spacing.xxs },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.xs },
  name: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  status: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  sub: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
  note: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textPrimary },
}); }
