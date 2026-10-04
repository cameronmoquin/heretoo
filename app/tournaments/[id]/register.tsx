/**
 * /tournaments/[id]/register — register as an individual golfer, or enter
 * a team (a foursome, usually) as its captain.
 *
 * Individual: the player's details, then the waiver (exactly the text
 * stored on the tournament, which is what the server freezes with the
 * signature) and a typed-name signature. One call:
 * nffga_register_for_tournament.
 *
 * Team: a team name, the captain's own details (prefilled from their
 * profile), up to team_size - 1 teammates by name (no accounts needed),
 * then the captain's own signature. One call: nffga_enter_team. Each
 * teammate signs the waiver at check-in.
 *
 * ?as=individual | team picks the starting mode.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/shared/Button';
import { Chip } from '../../../components/shared/Chip';
import { RequireAccount } from '../../../components/nffga/RequireAccount';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { formatMoney } from '../../../lib/nffga/types';
import { useSession } from '../../../lib/nffga/useSession';
import {
  SHIRT_SIZES, acceptsIndividuals, acceptsTeams, enterTeam, fetchMyProfile, formatWhen, registerForTournament,
  teamWord, tournamentKeys, useMyRegistration, useTournament,
  type RegistrationDetails, type ShirtSize, type TeammateInput,
} from '../../../lib/nffga/tournaments';
import {
  ChipPicker, ErrorText, Field, FieldRow, FormSection, Loading, Muted, Notice, PageTitle, Page, TextField, YesNo,
  blankToNull, numToText, toNumber,
} from '../../../components/nffga/tournaments/ui';

type Mode = 'individual' | 'team';
type Mate = { full_name: string; email: string; handicap: string; department_name: string; shirt_size: ShirtSize | null };
const emptyMate = (): Mate => ({ full_name: '', email: '', handicap: '', department_name: '', shirt_size: null });

export default function RegisterScreen() {
  const { id, as } = useLocalSearchParams<{ id: string; as?: string }>();
  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Register' }} />
      <RequireAccount reason="to register for a tournament">
        <RegisterForm id={id} initialMode={as === 'team' ? 'team' : as === 'individual' ? 'individual' : null} />
      </RequireAccount>
    </Page>
  );
}

function RegisterForm({ id, initialMode }: { id: string; initialMode: Mode | null }) {
  const s = makeStyles();
  const qc = useQueryClient();
  const { userId, email: sessionEmail } = useSession();
  const tq = useTournament(id);
  const mine = useMyRegistration(id, userId);
  const t = tq.data;

  const [chosen, setChosen] = useState<Mode | null>(initialMode);
  const [teamName, setTeamName] = useState('');
  const [mates, setMates] = useState<Mate[]>([]);
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

  // One row per open teammate slot.
  const teamSize = t?.team_size ?? 4;
  useEffect(() => {
    setMates((prev) => {
      const want = Math.max(0, teamSize - 1);
      if (prev.length === want) return prev;
      return Array.from({ length: want }, (_, i) => prev[i] ?? emptyMate());
    });
  }, [teamSize]);

  if (tq.isLoading) return <Loading />;
  if (!t) return <Notice>This tournament could not be found.</Notice>;

  const back = () => router.replace(`/tournaments/${t.id}` as any);
  const existing = mine.data && mine.data.status !== 'withdrawn' ? mine.data : null;
  const singlesOk = acceptsIndividuals(t);
  const teamsOk = acceptsTeams(t);
  const mode: Mode = chosen === 'team' && teamsOk ? 'team' : chosen === 'individual' && singlesOk ? 'individual' : teamsOk && !singlesOk ? 'team' : 'individual';
  const word = teamWord(t.team_size);

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
  const handicapErr = Number.isNaN(handicapNum) || (handicapNum != null && (handicapNum < -10 || handicapNum > 54))
    ? 'Enter a number from -10 to 54, like 12.4' : null;
  const yearsErr = Number.isNaN(yearsNum) || (yearsNum != null && (yearsNum < 0 || yearsNum > 70 || !Number.isInteger(yearsNum)))
    ? 'Enter whole years, 0 to 70' : null;
  const handicapNeeded = t.handicap_required && handicapNum == null;

  const mateErrors = mates.map((m) => {
    const filled = m.full_name.trim() || m.email.trim() || m.handicap.trim() || m.department_name.trim() || m.shirt_size;
    const h = toNumber(m.handicap);
    return {
      full_name: filled && !m.full_name.trim() ? 'Enter a name, or clear this row' : null,
      email: m.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email.trim()) ? 'Enter a valid email' : null,
      handicap: Number.isNaN(h) || (h != null && (h < -10 || h > 54)) ? 'Enter a number from -10 to 54' : null,
    };
  });
  const teamFee = t.team_fee_cents != null
    ? formatMoney(t.team_fee_cents, t.currency)
    : t.entry_fee_cents > 0 ? `${formatMoney(t.entry_fee_cents, t.currency)} per player` : null;

  function captainDetails(): RegistrationDetails {
    return {
      full_name: f.full_name.trim(),
      department_name: blankToNull(f.department_name),
      rank_title: blankToNull(f.rank_title),
      years_of_service: yearsNum as number | null,
      phone: blankToNull(f.phone),
      email: blankToNull(f.email),
      handicap: handicapNum as number | null,
      ghin_number: blankToNull(f.ghin_number),
      preferred_partners: mode === 'team' ? null : blankToNull(f.preferred_partners),
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
  }

  function after(status: string) {
    qc.invalidateQueries({ queryKey: tournamentKeys.mine(t!.id, userId) });
    qc.invalidateQueries({ queryKey: tournamentKeys.roster(t!.id) });
    qc.invalidateQueries({ queryKey: tournamentKeys.one(t!.id) });
    qc.invalidateQueries({ queryKey: tournamentKeys.all });
    const pay = t!.entry_fee_cents > 0 || (t!.team_fee_cents ?? 0) > 0 ? ' Pay the entry fee as described on the tournament page.' : '';
    if (mode === 'team') {
      setDone(status === 'waitlisted'
        ? 'The field is full, so your team is on the waitlist. It moves up automatically if enough spots open.'
        : `Your team is entered.${pay} Each teammate signs the waiver at check-in.`);
    } else {
      setDone(status === 'waitlisted'
        ? 'The field is full, so you are on the waitlist. You move up automatically if a spot opens.'
        : `You are registered.${pay}`);
    }
  }

  async function submit() {
    setErr(null);
    if (mode === 'team' && !teamName.trim()) { setErr('Enter a team name.'); return; }
    if (!f.full_name.trim()) { setErr('Enter your full name.'); return; }
    if (handicapErr || yearsErr) { setErr('Fix the highlighted fields.'); return; }
    if (handicapNeeded) { setErr('This tournament asks for your handicap.'); return; }
    if (mode === 'team' && mateErrors.some((e) => e.full_name || e.email || e.handicap)) { setErr('Fix the highlighted teammate fields.'); return; }
    if (t!.waiver_required && !signature.trim()) { setErr('Type your full name to sign the waiver.'); return; }

    setBusy(true);
    if (mode === 'team') {
      const teammates: TeammateInput[] = mates
        .filter((m) => m.full_name.trim())
        .map((m) => ({
          full_name: m.full_name.trim(),
          email: blankToNull(m.email),
          handicap: toNumber(m.handicap) as number | null,
          department_name: blankToNull(m.department_name),
          shirt_size: m.shirt_size,
        }));
      const r = await enterTeam(t!.id, teamName.trim(), teammates, captainDetails(), t!.waiver_required ? signature.trim() : null);
      setBusy(false);
      if (!r.ok) { setErr(r.error); return; }
      after(r.status);
    } else {
      const r = await registerForTournament(t!.id, captainDetails(), t!.waiver_required ? signature.trim() : null);
      setBusy(false);
      if (!r.ok) { setErr(r.error); return; }
      after(r.status);
    }
  }

  const setMate = (i: number, k: keyof Mate) => (v: any) =>
    setMates((p) => p.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  return (
    <View style={s.stack}>
      <PageTitle
        title={`Register: ${t.name}`}
        sub={[
          t.starts_at ? formatWhen(t.starts_at, t.timezone) : null,
          t.course_name,
        ].filter(Boolean).join('\n')}
      />

      {singlesOk && teamsOk ? (
        <Field label="How are you entering?">
          <View style={s.chips}>
            <Chip label="Register as an individual" selected={mode === 'individual'} onPress={() => setChosen('individual')} />
            <Chip label={`Enter a ${word}`} selected={mode === 'team'} onPress={() => setChosen('team')} />
          </View>
        </Field>
      ) : null}
      <Muted>
        {mode === 'team'
          ? `You enter as captain and list your teammates.${teamFee ? ` ${cap(word)} entry: ${teamFee}, paid to the organizer.` : ''}`
          : `${singlesOk && teamsOk ? `Individual golfers are placed in a ${word}. ` : ''}${t.entry_fee_cents > 0 ? `Entry: ${formatMoney(t.entry_fee_cents, t.currency)}, paid to the organizer.` : ''}`}
      </Muted>

      {mode === 'team' ? (
        <FormSection title="Team">
          <TextField label="Team name" required value={teamName} onChangeText={setTeamName} maxLength={80}
            help="As it should appear on the pairings sheet, for example your station or company." autoCapitalize="words" />
        </FormSection>
      ) : null}

      <FormSection title={mode === 'team' ? 'Captain (you)' : 'Player'}>
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
        {mode === 'individual' ? (
          <TextField label="Preferred partners" value={f.preferred_partners} onChangeText={set('preferred_partners')} help="Names or a station you would like to play with." />
        ) : null}
        <YesNo label="Cart" value={f.cart_request} onChange={set('cart_request')} yes="Riding" no="Walking" />
        <YesNo label="Rental clubs needed" value={f.needs_rental_clubs} onChange={set('needs_rental_clubs')} />
      </FormSection>

      {mode === 'team' ? (
        <FormSection title="Teammates">
          <Muted>
            {`Up to ${mates.length} ${mates.length === 1 ? 'teammate' : 'teammates'}. Only a name is required; teammates do not need an account. Leave a row empty if the organizer should fill that spot.`}
          </Muted>
          {mates.map((m, i) => (
            <View key={i} style={s.mate}>
              <Text style={s.mateTitle}>{`Player ${i + 2}`}</Text>
              <TextField label="Full name" value={m.full_name} onChangeText={setMate(i, 'full_name')} autoCapitalize="words" error={mateErrors[i]?.full_name} />
              <FieldRow>
                <TextField label="Email" value={m.email} onChangeText={setMate(i, 'email')} keyboardType="email-address" autoCapitalize="none" error={mateErrors[i]?.email} />
                <TextField label="Handicap" value={m.handicap} onChangeText={setMate(i, 'handicap')} keyboardType="decimal-pad" error={mateErrors[i]?.handicap} />
              </FieldRow>
              <TextField label="Department" value={m.department_name} onChangeText={setMate(i, 'department_name')} />
              <ChipPicker label="Shirt size" options={SHIRT_SIZES} value={m.shirt_size} onChange={setMate(i, 'shirt_size')} allowNone />
            </View>
          ))}
          <Muted>Teammate emails and shirt sizes are seen only by you and the organizers. The public field lists names and team.</Muted>
        </FormSection>
      ) : null}

      <FormSection title="Day of">
        <ChipPicker label={mode === 'team' ? 'Your shirt size' : 'Shirt size'} options={SHIRT_SIZES} value={f.shirt_size} onChange={set('shirt_size')} allowNone />
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
          {mode === 'team' ? <Muted>You sign for yourself only. Each teammate signs the waiver at check-in.</Muted> : null}
          <TextField label="Signature" required value={signature} onChangeText={setSignature} autoCapitalize="words"
            placeholder="Type your full name" help="Typing your name here signs the waiver above." />
        </FormSection>
      ) : null}

      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button
          title={mode === 'team'
            ? (t.waiver_required ? 'Sign and enter team' : 'Enter team')
            : (t.waiver_required ? 'Sign and register' : 'Register')}
          onPress={submit} variant="primary" size="lg" loading={busy}
          disabled={t.waiver_required && !t.waiver_text}
        />
        <Button title="Cancel" onPress={back} variant="ghost" size="lg" />
      </View>
    </View>
  );
}

function cap(w: string) { return w.charAt(0).toUpperCase() + w.slice(1); }

function makeStyles() { return StyleSheet.create({
  stack: { gap: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  mate: {
    gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media, padding: Spacing.md,
  },
  mateTitle: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, fontWeight: '700', color: Colors.textPrimary },
  waiver: {
    maxHeight: 420,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    padding: Spacing.md, backgroundColor: Colors.surfaceAlt,
  },
  waiverText: { fontSize: Type.ui.size, lineHeight: 21, color: Colors.textPrimary },
}); }
