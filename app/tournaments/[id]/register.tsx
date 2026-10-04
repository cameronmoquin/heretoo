/**
 * /tournaments/[id]/register — the player's registration form, then the
 * waiver (exactly the text stored on the tournament, which is what the
 * server freezes with the signature) and a typed-name signature.
 * One call: nffga_register_for_tournament.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/shared/Button';
import { RequireAccount } from '../../../components/nffga/RequireAccount';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { formatMoney } from '../../../lib/nffga/types';
import { useSession } from '../../../lib/nffga/useSession';
import {
  SHIRT_SIZES, fetchMyProfile, formatWhen, registerForTournament, tournamentKeys,
  useMyRegistration, useTournament, type RegistrationDetails, type ShirtSize,
} from '../../../lib/nffga/tournaments';
import {
  ChipPicker, ErrorText, FieldRow, FormSection, Loading, Notice, Page, PageTitle, TextField, YesNo,
  blankToNull, numToText, toNumber,
} from '../../../components/nffga/tournaments/ui';

export default function RegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Register' }} />
      <RequireAccount reason="to register for a tournament">
        <RegisterForm id={id} />
      </RequireAccount>
    </Page>
  );
}

function RegisterForm({ id }: { id: string }) {
  const s = makeStyles();
  const qc = useQueryClient();
  const { userId, email: sessionEmail } = useSession();
  const tq = useTournament(id);
  const mine = useMyRegistration(id, userId);
  const t = tq.data;

  const [f, setF] = useState({
    full_name: '', department_name: '', rank_title: '', years_of_service: '',
    phone: '', email: sessionEmail ?? '', handicap: '', ghin_number: '', preferred_partners: '',
    shirt_size: null as ShirtSize | null, dietary_notes: '', cart_request: true, needs_rental_clubs: false,
    accessibility_notes: '', emergency_contact_name: '', emergency_contact_phone: '',
    emergency_contact_relation: '', medical_notes: '', notes: '',
  });
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Prefill from the member profile, once.
  useEffect(() => {
    if (!userId) return;
    let off = false;
    fetchMyProfile(userId).then((p) => {
      if (off || !p) return;
      setF((prev) => ({
        ...prev,
        full_name: prev.full_name || p.display_name || '',
        department_name: prev.department_name || p.department || '',
        rank_title: prev.rank_title || p.rank_title || '',
        handicap: prev.handicap || numToText(p.handicap),
      }));
    });
    return () => { off = true; };
  }, [userId]);

  if (tq.isLoading) return <Loading />;
  if (!t) return <Notice>This tournament could not be found.</Notice>;

  const back = () => router.replace(`/tournaments/${t.id}` as any);
  const existing = mine.data && mine.data.status !== 'withdrawn' ? mine.data : null;

  if (done) {
    return (
      <View style={s.stack}>
        <PageTitle title={t.name} />
        <Notice>{done}</Notice>
        <View style={s.actions}><Button title="Back to the tournament" onPress={back} variant="primary" /></View>
      </View>
    );
  }
  if (existing) {
    return (
      <View style={s.stack}>
        <PageTitle title={t.name} />
        <Notice>{existing.status === 'waitlisted' ? 'You are on the waitlist for this tournament.' : 'You are already registered for this tournament.'}</Notice>
        <View style={s.actions}><Button title="Back to the tournament" onPress={back} variant="outline" /></View>
      </View>
    );
  }
  if (t.status !== 'registration_open') {
    return (
      <View style={s.stack}>
        <PageTitle title={t.name} />
        <Notice>Registration is not open for this tournament.</Notice>
        <View style={s.actions}><Button title="Back to the tournament" onPress={back} variant="outline" /></View>
      </View>
    );
  }

  const handicapNum = toNumber(f.handicap);
  const yearsNum = toNumber(f.years_of_service);
  const handicapErr = Number.isNaN(handicapNum) ? 'Enter a number, like 12.4' : null;
  const yearsErr = Number.isNaN(yearsNum) || (yearsNum != null && (yearsNum < 0 || yearsNum > 70 || !Number.isInteger(yearsNum)))
    ? 'Enter whole years, 0 to 70' : null;
  const handicapNeeded = t.handicap_required && handicapNum == null;

  async function submit() {
    setErr(null);
    if (!f.full_name.trim()) { setErr('Enter your full name.'); return; }
    if (handicapErr || yearsErr) { setErr('Fix the highlighted fields.'); return; }
    if (handicapNeeded) { setErr('This tournament asks for your handicap.'); return; }
    if (t!.waiver_required && !signature.trim()) { setErr('Type your full name to sign the waiver.'); return; }

    const details: RegistrationDetails = {
      full_name: f.full_name.trim(),
      department_name: blankToNull(f.department_name),
      rank_title: blankToNull(f.rank_title),
      years_of_service: yearsNum as number | null,
      phone: blankToNull(f.phone),
      email: blankToNull(f.email),
      handicap: handicapNum as number | null,
      ghin_number: blankToNull(f.ghin_number),
      preferred_partners: blankToNull(f.preferred_partners),
      shirt_size: f.shirt_size,
      dietary_notes: blankToNull(f.dietary_notes),
      cart_request: f.cart_request,
      needs_rental_clubs: f.needs_rental_clubs,
      accessibility_notes: blankToNull(f.accessibility_notes),
      emergency_contact_name: blankToNull(f.emergency_contact_name),
      emergency_contact_phone: blankToNull(f.emergency_contact_phone),
      emergency_contact_relation: blankToNull(f.emergency_contact_relation),
      medical_notes: blankToNull(f.medical_notes),
      notes: blankToNull(f.notes),
    };

    setBusy(true);
    const r = await registerForTournament(t!.id, details, t!.waiver_required ? signature.trim() : null);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    qc.invalidateQueries({ queryKey: tournamentKeys.mine(t!.id, userId) });
    qc.invalidateQueries({ queryKey: tournamentKeys.roster(t!.id) });
    qc.invalidateQueries({ queryKey: tournamentKeys.one(t!.id) });
    qc.invalidateQueries({ queryKey: tournamentKeys.all });
    setDone(r.status === 'waitlisted'
      ? 'The field is full, so you are on the waitlist. You move up automatically if a spot opens.'
      : 'You are registered.' + (t!.entry_fee_cents > 0 ? ' Pay the entry fee as described on the tournament page.' : ''));
  }

  return (
    <View style={s.stack}>
      <PageTitle
        title={`Register: ${t.name}`}
        sub={[
          t.starts_at ? formatWhen(t.starts_at, t.timezone) : null,
          t.course_name,
          t.entry_fee_cents > 0 ? `Entry ${formatMoney(t.entry_fee_cents, t.currency)}, paid to the organizer` : null,
        ].filter(Boolean).join('\n')}
      />

      <FormSection title="Player">
        <TextField label="Full name" required value={f.full_name} onChangeText={set('full_name')} help="As it should appear on the pairings sheet." autoCapitalize="words" />
        <FieldRow>
          <TextField label="Department" value={f.department_name} onChangeText={set('department_name')} />
          <TextField label="Rank or title" value={f.rank_title} onChangeText={set('rank_title')} />
        </FieldRow>
        <FieldRow>
          <TextField label="Years of service" value={f.years_of_service} onChangeText={set('years_of_service')} keyboardType="number-pad" error={yearsErr} />
          <TextField label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <TextField label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        </FieldRow>
      </FormSection>

      <FormSection title="Golf">
        <FieldRow>
          <TextField label="Handicap" required={t.handicap_required} value={f.handicap} onChangeText={set('handicap')} keyboardType="decimal-pad" error={handicapErr}
            help={t.handicap_max != null ? `Maximum for this event: ${t.handicap_max}` : undefined} />
          <TextField label="GHIN number" value={f.ghin_number} onChangeText={set('ghin_number')} />
        </FieldRow>
        <TextField label="Preferred partners" value={f.preferred_partners} onChangeText={set('preferred_partners')} help="Names or a station you would like to play with." />
        <YesNo label="Cart" value={f.cart_request} onChange={set('cart_request')} yes="Riding" no="Walking" />
        <YesNo label="Rental clubs needed" value={f.needs_rental_clubs} onChange={set('needs_rental_clubs')} />
      </FormSection>

      <FormSection title="Day of">
        <ChipPicker label="Shirt size" options={SHIRT_SIZES} value={f.shirt_size} onChange={set('shirt_size')} allowNone />
        <TextField label="Dietary notes" value={f.dietary_notes} onChangeText={set('dietary_notes')} />
        <TextField label="Accessibility needs" value={f.accessibility_notes} onChangeText={set('accessibility_notes')} />
      </FormSection>

      <FormSection title="Emergency contact">
        <FieldRow>
          <TextField label="Name" value={f.emergency_contact_name} onChangeText={set('emergency_contact_name')} autoCapitalize="words" />
          <TextField label="Phone" value={f.emergency_contact_phone} onChangeText={set('emergency_contact_phone')} keyboardType="phone-pad" />
          <TextField label="Relationship" value={f.emergency_contact_relation} onChangeText={set('emergency_contact_relation')} />
        </FieldRow>
        <TextField label="Medical notes" value={f.medical_notes} onChangeText={set('medical_notes')} multiline={3}
          help="Allergies or conditions responders should know. Only the organizers see this." />
      </FormSection>

      <FormSection title="Anything else">
        <TextField label="Notes for the organizer" value={f.notes} onChangeText={set('notes')} multiline={3} />
      </FormSection>

      {t.waiver_required ? (
        <FormSection title="Waiver">
          {t.waiver_text ? (
            <ScrollView style={s.waiver} nestedScrollEnabled>
              <Text style={s.waiverText} selectable>{t.waiver_text}</Text>
            </ScrollView>
          ) : (
            <Notice>The organizer has not posted the waiver yet, so registration cannot be completed.</Notice>
          )}
          <TextField label="Signature" required value={signature} onChangeText={setSignature} autoCapitalize="words"
            placeholder="Type your full name" help="Typing your name here signs the waiver above." />
        </FormSection>
      ) : null}

      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title={t.waiver_required ? 'Sign and register' : 'Register'} onPress={submit} variant="primary" size="lg" loading={busy}
          disabled={t.waiver_required && !t.waiver_text} />
        <Button title="Cancel" onPress={back} variant="ghost" size="lg" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  stack: { gap: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  waiver: {
    maxHeight: 420,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    padding: Spacing.md, backgroundColor: Colors.surfaceAlt,
  },
  waiverText: { fontSize: Type.ui.size, lineHeight: 21, color: Colors.textPrimary },
}); }
