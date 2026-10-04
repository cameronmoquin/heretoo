/**
 * TournamentForm — the organizer's sheet for creating or editing a
 * tournament. Every column of nffga_tournaments the organizer controls,
 * in sections. Dates are typed as "YYYY-MM-DD HH:MM" in the tournament's
 * time zone and stored as UTC.
 *
 * The waiver starts from DEFAULT_WAIVER_TEXT. Its [BRACKETED]
 * placeholders are filled from this form on save, so the stored text is
 * exactly what a player reads and signs.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type, Heights } from '../../../constants/design';
import { DEFAULT_WAIVER_TEXT, WAIVER_PLACEHOLDERS, renderWaiver, type WaiverPlaceholder } from '../../../constants/waiver';
import { SITE_LONG_NAME } from '../../../constants/site';
import type { Tournament, TournamentFormat, TournamentStatus } from '../../../lib/nffga/types';
import {
  DEFAULT_TIMEZONE, FORMAT_LABEL, START_TYPE_LABEL, STATUS_LABEL, TOURNAMENT_FORMATS, TOURNAMENT_STATUSES,
  formatDay, localToUtcIso, utcToLocalInput, type TournamentInput,
} from '../../../lib/nffga/tournaments';
import {
  ChipPicker, ErrorText, Field, FieldRow, FormSection, Muted, TextField, YesNo,
  blankToNull, centsToDollars, dollarsToCents, numToText, toNumber,
} from './ui';

type ScheduleLine = { at: string; what: string };

function initialState(t?: Tournament | null) {
  const tz = t?.timezone || DEFAULT_TIMEZONE;
  return {
    status: (t?.status ?? 'draft') as TournamentStatus,
    name: t?.name ?? '',
    description: t?.description ?? '',
    public_notes: t?.public_notes ?? '',
    beneficiary: t?.beneficiary ?? '',

    format: (t?.format ?? 'scramble') as TournamentFormat,
    format_notes: t?.format_notes ?? '',
    team_size: t?.team_size ?? 4,
    holes: t?.holes ?? 18,
    flights: t?.flights ?? '',
    handicap_required: t?.handicap_required ?? false,
    handicap_max: numToText(t?.handicap_max),

    timezone: tz,
    starts_at: utcToLocalInput(t?.starts_at, tz),
    ends_at: utcToLocalInput(t?.ends_at, tz),
    check_in_at: utcToLocalInput(t?.check_in_at, tz),
    start_type: (t?.start_type ?? 'shotgun') as Tournament['start_type'],
    tee_interval_min: numToText(t?.tee_interval_min),
    registration_opens_at: utcToLocalInput(t?.registration_opens_at, tz),
    registration_closes_at: utcToLocalInput(t?.registration_closes_at, tz),
    rain_date: t?.rain_date ?? '',
    rain_policy: t?.rain_policy ?? '',
    schedule: (t?.schedule ?? []).map((x) => ({ at: x.at ?? '', what: x.what ?? '' })) as ScheduleLine[],

    course_name: t?.course_name ?? '',
    course_address: t?.course_address ?? '',
    course_city: t?.course_city ?? '',
    course_state: t?.course_state ?? '',
    course_postal: t?.course_postal ?? '',
    course_phone: t?.course_phone ?? '',
    course_url: t?.course_url ?? '',

    max_players: numToText(t?.max_players),
    max_teams: numToText(t?.max_teams),
    waitlist_enabled: t?.waitlist_enabled ?? true,

    entry_fee: centsToDollars(t?.entry_fee_cents ?? 0),
    currency: t?.currency ?? 'USD',
    fee_includes: t?.fee_includes ?? '',
    payment_instructions: t?.payment_instructions ?? '',
    payment_url: t?.payment_url ?? '',

    dress_code: t?.dress_code ?? '',
    cart_policy: t?.cart_policy ?? '',
    mulligans_policy: t?.mulligans_policy ?? '',
    alcohol_policy: t?.alcohol_policy ?? '',
    meal_included: t?.meal_included ?? false,
    meal_notes: t?.meal_notes ?? '',
    prizes: t?.prizes ?? '',
    sponsors: t?.sponsors ?? '',

    contact_name: t?.contact_name ?? '',
    contact_email: t?.contact_email ?? '',
    contact_phone: t?.contact_phone ?? '',

    waiver_required: t?.waiver_required ?? true,
    waiver_text: t ? (t.waiver_text ?? '') : DEFAULT_WAIVER_TEXT,
    host_organization: SITE_LONG_NAME,
  };
}

type FormState = ReturnType<typeof initialState>;

const DATE_HELP = 'YYYY-MM-DD HH:MM, 24-hour, local time';

export function TournamentForm({ initial, onSave, onCancel, saveLabel }: {
  initial?: Tournament | null;
  onSave: (input: TournamentInput) => Promise<string | null>;
  onCancel: () => void;
  saveLabel: string;
}) {
  const s = makeStyles();
  const [f, setF] = useState<FormState>(() => initialState(initial));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const tz = f.timezone.trim() || DEFAULT_TIMEZONE;
  const dateErr = (v: string) => (v.trim() && !localToUtcIso(v, tz) ? 'Use YYYY-MM-DD HH:MM' : null);
  const numErr = (v: string, opts: { int?: boolean; min?: number; max?: number } = {}) => {
    const n = toNumber(v);
    if (n == null) return null;
    if (Number.isNaN(n)) return 'Enter a number';
    if (opts.int && !Number.isInteger(n)) return 'Enter a whole number';
    if (opts.min != null && n < opts.min) return `At least ${opts.min}`;
    if (opts.max != null && n > opts.max) return `At most ${opts.max}`;
    return null;
  };
  const feeCents = dollarsToCents(f.entry_fee);
  const errors = {
    starts_at: dateErr(f.starts_at),
    ends_at: dateErr(f.ends_at),
    check_in_at: dateErr(f.check_in_at),
    registration_opens_at: dateErr(f.registration_opens_at),
    registration_closes_at: dateErr(f.registration_closes_at),
    rain_date: f.rain_date.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(f.rain_date.trim()) ? 'Use YYYY-MM-DD' : null,
    handicap_max: numErr(f.handicap_max, { min: 0, max: 54 }),
    tee_interval_min: numErr(f.tee_interval_min, { int: true, min: 5, max: 20 }),
    max_players: numErr(f.max_players, { int: true, min: 1 }),
    max_teams: numErr(f.max_teams, { int: true, min: 1 }),
    entry_fee: Number.isNaN(feeCents as number) ? 'Enter dollars, like 125 or 125.50' : null,
  };

  function placeholderValues(): Partial<Record<WaiverPlaceholder, string>> {
    const startsIso = localToUtcIso(f.starts_at, tz);
    return {
      EVENT_NAME: f.name.trim(),
      EVENT_DATE: startsIso ? formatDay(startsIso, tz) : '',
      COURSE_NAME: f.course_name.trim(),
      HOST_ORGANIZATION: f.host_organization.trim(),
    };
  }

  const placeholderLabel: Record<WaiverPlaceholder, string> = {
    EVENT_NAME: 'the tournament name',
    EVENT_DATE: 'the start date',
    COURSE_NAME: 'the course name',
    HOST_ORGANIZATION: 'the host organization',
  };

  async function save() {
    setErr(null);
    if (f.name.trim().length < 3) { setErr('Give the tournament a name (at least 3 characters).'); return; }
    if (Object.values(errors).some(Boolean)) { setErr('Fix the highlighted fields.'); return; }
    const starts = localToUtcIso(f.starts_at, tz);
    const ends = localToUtcIso(f.ends_at, tz);
    if (starts && ends && ends < starts) { setErr('The end time must be after the start time.'); return; }
    if (f.status !== 'draft' && !starts) { setErr('Add a start date and time before publishing.'); return; }

    // Fill the waiver placeholders that have values. A published
    // tournament may not keep any unfilled.
    let waiver = f.waiver_text;
    const values = placeholderValues();
    const present = WAIVER_PLACEHOLDERS.filter((k) => waiver.includes(`[${k}]`));
    const missing = present.filter((k) => !values[k]);
    if (missing.length === 0 && present.length > 0) {
      waiver = renderWaiver(waiver, values as Record<WaiverPlaceholder, string>);
    } else {
      for (const k of present) if (values[k]) waiver = waiver.split(`[${k}]`).join(values[k] as string);
    }
    if (f.waiver_required && f.status !== 'draft') {
      if (!waiver.trim()) { setErr('Add the waiver text, or turn the waiver off.'); return; }
      if (missing.length > 0) {
        setErr(`The waiver needs ${missing.map((k) => placeholderLabel[k]).join(', ')}. Fill those in, or save as a draft.`);
        return;
      }
    }

    const schedule = f.schedule
      .map((x) => ({ at: x.at.trim(), what: x.what.trim() }))
      .filter((x) => x.at || x.what);

    const input: TournamentInput = {
      status: f.status,
      name: f.name.trim(),
      description: blankToNull(f.description),
      public_notes: blankToNull(f.public_notes),
      beneficiary: blankToNull(f.beneficiary),
      format: f.format,
      format_notes: blankToNull(f.format_notes),
      team_size: f.team_size,
      holes: f.holes,
      flights: blankToNull(f.flights),
      handicap_required: f.handicap_required,
      handicap_max: toNumber(f.handicap_max),
      timezone: tz,
      starts_at: starts,
      ends_at: ends,
      check_in_at: localToUtcIso(f.check_in_at, tz),
      start_type: f.start_type,
      tee_interval_min: f.start_type === 'tee_times' ? toNumber(f.tee_interval_min) : null,
      registration_opens_at: localToUtcIso(f.registration_opens_at, tz),
      registration_closes_at: localToUtcIso(f.registration_closes_at, tz),
      rain_date: blankToNull(f.rain_date),
      rain_policy: blankToNull(f.rain_policy),
      schedule,
      course_name: blankToNull(f.course_name),
      course_address: blankToNull(f.course_address),
      course_city: blankToNull(f.course_city),
      course_state: blankToNull(f.course_state),
      course_postal: blankToNull(f.course_postal),
      course_phone: blankToNull(f.course_phone),
      course_url: blankToNull(f.course_url),
      max_players: toNumber(f.max_players),
      max_teams: toNumber(f.max_teams),
      waitlist_enabled: f.waitlist_enabled,
      entry_fee_cents: feeCents ?? 0,
      currency: f.currency || 'USD',
      fee_includes: blankToNull(f.fee_includes),
      payment_instructions: blankToNull(f.payment_instructions),
      payment_url: blankToNull(f.payment_url),
      dress_code: blankToNull(f.dress_code),
      cart_policy: blankToNull(f.cart_policy),
      mulligans_policy: blankToNull(f.mulligans_policy),
      alcohol_policy: blankToNull(f.alcohol_policy),
      meal_included: f.meal_included,
      meal_notes: blankToNull(f.meal_notes),
      prizes: blankToNull(f.prizes),
      sponsors: blankToNull(f.sponsors),
      contact_name: blankToNull(f.contact_name),
      contact_email: blankToNull(f.contact_email),
      contact_phone: blankToNull(f.contact_phone),
      waiver_required: f.waiver_required,
      waiver_text: waiver.trim() ? waiver : null,
    };

    setBusy(true);
    const e = await onSave(input);
    setBusy(false);
    if (e) setErr(e);
    else setF((p) => ({ ...p, waiver_text: waiver }));
  }

  const setLine = (i: number, k: keyof ScheduleLine) => (v: string) =>
    setF((p) => ({ ...p, schedule: p.schedule.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  return (
    <View style={s.form}>
      <FormSection title="Basics">
        <TextField label="Name" required value={f.name} onChangeText={set('name')} maxLength={140} />
        <ChipPicker label="Status" options={TOURNAMENT_STATUSES} value={f.status} onChange={(v) => v && set('status')(v)} labels={STATUS_LABEL}
          help="Drafts are visible only to organizers and officers." />
        <TextField label="Description" value={f.description} onChangeText={set('description')} multiline={5} />
        <TextField label="Notice" value={f.public_notes} onChangeText={set('public_notes')} multiline={2} help="Shown at the top of the tournament page." />
        <TextField label="Beneficiary" value={f.beneficiary} onChangeText={set('beneficiary')} help="Charity or fund the event supports." />
      </FormSection>

      <FormSection title="When">
        <TextField label="Time zone" value={f.timezone} onChangeText={set('timezone')} autoCapitalize="none" help="For example America/New_York or America/Chicago." />
        <FieldRow>
          <TextField label="Starts" value={f.starts_at} onChangeText={set('starts_at')} placeholder="2026-10-18 08:00" help={DATE_HELP} error={errors.starts_at} />
          <TextField label="Ends" value={f.ends_at} onChangeText={set('ends_at')} placeholder="2026-10-18 14:00" error={errors.ends_at} />
          <TextField label="Check-in" value={f.check_in_at} onChangeText={set('check_in_at')} placeholder="2026-10-18 07:00" error={errors.check_in_at} />
        </FieldRow>
        <ChipPicker label="Start type" options={['shotgun', 'tee_times'] as const} value={f.start_type} onChange={(v) => v && set('start_type')(v)} labels={START_TYPE_LABEL} />
        {f.start_type === 'tee_times' ? (
          <TextField label="Minutes between groups" value={f.tee_interval_min} onChangeText={set('tee_interval_min')} keyboardType="number-pad" error={errors.tee_interval_min} help="5 to 20" />
        ) : null}
        <FieldRow>
          <TextField label="Registration opens" value={f.registration_opens_at} onChangeText={set('registration_opens_at')} placeholder="Leave blank to open now" error={errors.registration_opens_at} />
          <TextField label="Registration closes" value={f.registration_closes_at} onChangeText={set('registration_closes_at')} placeholder="2026-10-11 23:59" error={errors.registration_closes_at} />
        </FieldRow>
        <FieldRow>
          <TextField label="Rain date" value={f.rain_date} onChangeText={set('rain_date')} placeholder="2026-10-25" error={errors.rain_date} help="YYYY-MM-DD" />
          <TextField label="Rain policy" value={f.rain_policy} onChangeText={set('rain_policy')} />
        </FieldRow>
        <Field label="Schedule" help="One line per item, for example 07:00 Registration and range.">
          <View style={s.schedule}>
            {f.schedule.map((line, i) => (
              <View key={i} style={s.schedRow}>
                <TextInput value={line.at} onChangeText={setLine(i, 'at')} placeholder="07:00" placeholderTextColor={Colors.textMuted}
                  style={[s.input, s.schedAt]} accessibilityLabel={`Schedule time ${i + 1}`} />
                <TextInput value={line.what} onChangeText={setLine(i, 'what')} placeholder="What happens" placeholderTextColor={Colors.textMuted}
                  style={[s.input, s.schedWhat]} accessibilityLabel={`Schedule item ${i + 1}`} />
                <Pressable onPress={() => setF((p) => ({ ...p, schedule: p.schedule.filter((_, j) => j !== i) }))}
                  style={s.remove} accessibilityRole="button" accessibilityLabel={`Remove schedule line ${i + 1}`}>
                  <Text style={s.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <View style={s.inline}>
              <Button title="Add line" onPress={() => setF((p) => ({ ...p, schedule: [...p.schedule, { at: '', what: '' }] }))} variant="outline" size="sm" />
            </View>
          </View>
        </Field>
      </FormSection>

      <FormSection title="Where">
        <TextField label="Course" value={f.course_name} onChangeText={set('course_name')} />
        <TextField label="Street address" value={f.course_address} onChangeText={set('course_address')} />
        <FieldRow>
          <TextField label="City" value={f.course_city} onChangeText={set('course_city')} />
          <TextField label="State" value={f.course_state} onChangeText={set('course_state')} autoCapitalize="characters" maxLength={30} />
          <TextField label="ZIP" value={f.course_postal} onChangeText={set('course_postal')} keyboardType="number-pad" />
        </FieldRow>
        <FieldRow>
          <TextField label="Course phone" value={f.course_phone} onChangeText={set('course_phone')} keyboardType="phone-pad" />
          <TextField label="Course website" value={f.course_url} onChangeText={set('course_url')} autoCapitalize="none" keyboardType="url" />
        </FieldRow>
      </FormSection>

      <FormSection title="Format">
        <ChipPicker label="Format" options={TOURNAMENT_FORMATS} value={f.format} onChange={(v) => v && set('format')(v)} labels={FORMAT_LABEL} />
        <TextField label="Format notes" value={f.format_notes} onChangeText={set('format_notes')} multiline={2} />
        <ChipPicker<number> label="Team size" options={[1, 2, 3, 4, 5, 6]} value={f.team_size} onChange={(v) => v && set('team_size')(v)}
          labels={{ 1: 'Individual' }} />
        <ChipPicker<number> label="Holes" options={[9, 18, 27, 36]} value={f.holes} onChange={(v) => v && set('holes')(v)} />
        <TextField label="Flights" value={f.flights} onChangeText={set('flights')} placeholder="A/B/C by handicap" />
        <FieldRow>
          <YesNo label="Handicap required" value={f.handicap_required} onChange={set('handicap_required')} />
          <TextField label="Maximum handicap" value={f.handicap_max} onChangeText={set('handicap_max')} keyboardType="decimal-pad" error={errors.handicap_max} />
        </FieldRow>
      </FormSection>

      <FormSection title="Field size">
        <FieldRow>
          <TextField label="Maximum players" value={f.max_players} onChangeText={set('max_players')} keyboardType="number-pad" error={errors.max_players} help="Blank for no limit." />
          <TextField label="Maximum teams" value={f.max_teams} onChangeText={set('max_teams')} keyboardType="number-pad" error={errors.max_teams} />
        </FieldRow>
        <YesNo label="Waitlist when full" value={f.waitlist_enabled} onChange={set('waitlist_enabled')} />
      </FormSection>

      <FormSection title="Entry fee">
        <TextField label="Entry fee (dollars)" value={f.entry_fee} onChangeText={set('entry_fee')} keyboardType="decimal-pad" error={errors.entry_fee} help="0 for no fee." />
        <TextField label="Fee includes" value={f.fee_includes} onChangeText={set('fee_includes')} placeholder="Green fee, cart, lunch" />
        <TextField label="How to pay" value={f.payment_instructions} onChangeText={set('payment_instructions')} multiline={3}
          help="Payment goes to the organizer directly. This site does not take payments." />
        <TextField label="Payment link" value={f.payment_url} onChangeText={set('payment_url')} autoCapitalize="none" keyboardType="url" />
      </FormSection>

      <FormSection title="Rules">
        <TextField label="Dress code" value={f.dress_code} onChangeText={set('dress_code')} />
        <TextField label="Carts" value={f.cart_policy} onChangeText={set('cart_policy')} />
        <TextField label="Mulligans" value={f.mulligans_policy} onChangeText={set('mulligans_policy')} />
        <TextField label="Alcohol" value={f.alcohol_policy} onChangeText={set('alcohol_policy')} />
        <YesNo label="Meal included" value={f.meal_included} onChange={set('meal_included')} />
        <TextField label="Meal notes" value={f.meal_notes} onChangeText={set('meal_notes')} />
      </FormSection>

      <FormSection title="Prizes and sponsors">
        <TextField label="Prizes" value={f.prizes} onChangeText={set('prizes')} multiline={3} />
        <TextField label="Sponsors" value={f.sponsors} onChangeText={set('sponsors')} multiline={3} />
      </FormSection>

      <FormSection title="Contact">
        <FieldRow>
          <TextField label="Name" value={f.contact_name} onChangeText={set('contact_name')} autoCapitalize="words" />
          <TextField label="Email" value={f.contact_email} onChangeText={set('contact_email')} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Phone" value={f.contact_phone} onChangeText={set('contact_phone')} keyboardType="phone-pad" />
        </FieldRow>
      </FormSection>

      <FormSection title="Waiver">
        <YesNo label="Players sign a waiver to register" value={f.waiver_required} onChange={set('waiver_required')} />
        {f.waiver_required ? (
          <>
            <TextField label="Host organization" value={f.host_organization} onChangeText={set('host_organization')}
              help="Fills [HOST_ORGANIZATION] in the waiver." />
            <TextField label="Waiver text" value={f.waiver_text} onChangeText={set('waiver_text')} multiline={16}
              help="[EVENT_NAME], [EVENT_DATE], [COURSE_NAME] and [HOST_ORGANIZATION] are filled in from this form when you save. Players sign exactly the saved text." />
            <View style={s.inline}>
              <Button title="Start over from the default text" onPress={() => set('waiver_text')(DEFAULT_WAIVER_TEXT)} variant="ghost" size="sm" />
            </View>
            <Muted>The default text is a draft that has not been reviewed by counsel.</Muted>
          </>
        ) : null}
      </FormSection>

      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title={saveLabel} onPress={save} variant="primary" size="lg" loading={busy} />
        <Button title="Cancel" onPress={onCancel} variant="ghost" size="lg" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  form: { gap: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  inline: { flexDirection: 'row' },
  schedule: { gap: Spacing.xs },
  schedRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center' },
  input: {
    minHeight: Heights.input, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
    fontSize: Type.body.size, color: Colors.textPrimary,
  },
  schedAt: { width: 96 },
  schedWhat: { flex: 1, minWidth: 0 },
  remove: { minHeight: Heights.touchTarget, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  removeText: { fontSize: Type.ui.size, color: Colors.textSecondary },
}); }
