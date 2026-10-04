/**
 * /tournaments/[id] — the full logistics sheet. Readable by anyone;
 * registering asks for an account.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/shared/Button';
import { confirm } from '../../../components/shared/ConfirmSheet';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { formatMoney } from '../../../lib/nffga/types';
import { useSession } from '../../../lib/nffga/useSession';
import { signInHref } from '../../../lib/nffga/auth';
import {
  FORMAT_LABEL, START_TYPE_LABEL, STATUS_LABEL, courseCityState, formatDateOnly, formatWhen,
  spotsLeft, tournamentKeys, useLeaderboard, useMyRegistration, useNffgaRole, useRoster,
  useTournament, withdrawFromTournament, type RosterEntry, type LeaderboardRow,
} from '../../../lib/nffga/tournaments';
import {
  ErrorText, Loading, Muted, Notice, Page, PageTitle, Paragraph, Row, Section,
} from '../../../components/nffga/tournaments/ui';

export default function TournamentScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const qc = useQueryClient();
  const { role } = useNffgaRole(userId);
  const tq = useTournament(id);
  const roster = useRoster(id);
  const board = useLeaderboard(id);
  const mine = useMyRegistration(id, userId);
  const t = tq.data;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (tq.isLoading) return <Page><Loading /></Page>;
  if (!t) {
    return (
      <Page>
        <Stack.Screen options={{ title: 'Tournament' }} />
        <Notice>This tournament could not be found. It may not be published yet.</Notice>
        <View><Button title="All tournaments" onPress={() => router.replace('/tournaments' as any)} variant="outline" /></View>
      </Page>
    );
  }

  const canManage = !!role || (!!userId && t.organizer_id === userId);
  const tz = t.timezone;
  const left = spotsLeft(t);
  const reg = mine.data && mine.data.status !== 'withdrawn' ? mine.data : null;
  const open = t.status === 'registration_open';
  const place = [t.course_name, courseCityState(t)].filter(Boolean).join(' · ');
  const address = [t.course_address, [t.course_city, t.course_state].filter(Boolean).join(', '), t.course_postal]
    .filter(Boolean).join(', ');

  function goRegister() {
    const path = `/tournaments/${t!.id}/register`;
    router.push((userId ? path : signInHref(path)) as any);
  }

  function withdraw() {
    confirm({
      title: 'Withdraw from this tournament?',
      message: 'Your spot goes to the next person on the waitlist.',
      confirmLabel: 'Withdraw',
      destructive: true,
      onConfirm: async () => {
        setBusy(true); setErr(null);
        const r = await withdrawFromTournament(t!.id);
        setBusy(false);
        if (!r.ok) { setErr(r.error ?? 'Could not withdraw.'); return; }
        qc.invalidateQueries({ queryKey: tournamentKeys.mine(t!.id, userId) });
        qc.invalidateQueries({ queryKey: tournamentKeys.roster(t!.id) });
        qc.invalidateQueries({ queryKey: tournamentKeys.one(t!.id) });
        qc.invalidateQueries({ queryKey: tournamentKeys.all });
      },
    });
  }

  const openUrl = (u: string) => () => { Linking.openURL(/^https?:\/\//i.test(u) ? u : `https://${u}`).catch(() => {}); };

  return (
    <Page>
      <Stack.Screen options={{ title: t.name }} />
      <PageTitle
        title={t.name}
        sub={[t.starts_at ? formatWhen(t.starts_at, tz) : 'Date to be announced', place].filter(Boolean).join('\n')}
        right={canManage ? (
          <Button title="Edit" onPress={() => router.push(`/tournaments/${t.id}/edit` as any)} variant="outline" size="md" />
        ) : null}
      />

      {/* Registration panel */}
      <View style={s.panel}>
        <View style={s.panelText}>
          <Text style={s.panelStatus}>{STATUS_LABEL[t.status]}</Text>
          <Text style={s.panelFacts}>
            {[
              t.entry_fee_cents > 0 ? `Entry ${formatMoney(t.entry_fee_cents, t.currency)}` : 'No entry fee',
              t.max_players != null ? `${t.registered_count ?? 0} of ${t.max_players} spots filled` : `${t.registered_count ?? 0} registered`,
              left === 0 && t.waitlist_enabled ? 'Waitlist open' : null,
            ].filter(Boolean).join(' · ')}
          </Text>
          {reg ? (
            <Text style={s.panelMine}>
              {reg.status === 'waitlisted' ? 'You are on the waitlist.' : reg.status === 'checked_in' ? 'You are checked in.' : 'You are registered.'}
            </Text>
          ) : null}
          {t.registration_closes_at && open ? <Muted>Registration closes {formatWhen(t.registration_closes_at, tz)}</Muted> : null}
          {t.registration_opens_at && open && Date.parse(t.registration_opens_at) > Date.now()
            ? <Muted>Registration opens {formatWhen(t.registration_opens_at, tz)}</Muted> : null}
        </View>
        <View style={s.panelActions}>
          {reg ? (
            <Button title="Withdraw" onPress={withdraw} variant="outline" size="md" loading={busy} />
          ) : open ? (
            <Button title={left === 0 && t.waitlist_enabled ? 'Join waitlist' : 'Register'} onPress={goRegister} variant="primary" size="lg"
              disabled={left === 0 && !t.waitlist_enabled} />
          ) : null}
        </View>
      </View>
      <ErrorText>{err}</ErrorText>

      {t.description ? <Paragraph>{t.description}</Paragraph> : null}
      {t.public_notes ? <Notice>{t.public_notes}</Notice> : null}

      <View style={s.grid}>
        <Section title="When" style={s.cell}>
          <Row label="Starts" value={formatWhen(t.starts_at, tz)} />
          <Row label="Ends" value={formatWhen(t.ends_at, tz)} />
          <Row label="Check-in" value={formatWhen(t.check_in_at, tz)} />
          <Row label="Start" value={START_TYPE_LABEL[t.start_type] + (t.start_type === 'tee_times' && t.tee_interval_min ? `, every ${t.tee_interval_min} min` : '')} />
          <Row label="Registration opens" value={formatWhen(t.registration_opens_at, tz)} />
          <Row label="Registration closes" value={formatWhen(t.registration_closes_at, tz)} />
          {t.schedule.length > 0 ? (
            <View style={s.schedule}>
              <Text style={s.subhead}>Schedule</Text>
              {t.schedule.map((item, i) => (
                <View key={i} style={s.schedRow}>
                  <Text style={s.schedAt}>{item.at}</Text>
                  <Text style={s.schedWhat}>{item.what}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Where" style={s.cell}>
          <Row label="Course" value={t.course_name} />
          <Row label="Address" value={address} />
          <Row label="Phone" value={t.course_phone} onPress={t.course_phone ? () => Linking.openURL(`tel:${t.course_phone}`).catch(() => {}) : undefined} />
          <Row label="Website" value={t.course_url} onPress={t.course_url ? openUrl(t.course_url) : undefined} />
          <Row label="Rain date" value={formatDateOnly(t.rain_date)} />
          <Row label="Rain policy" value={t.rain_policy} />
          {!t.course_name && !address ? <Muted>Course to be announced.</Muted> : null}
        </Section>

        <Section title="Format" style={s.cell}>
          <Row label="Format" value={FORMAT_LABEL[t.format] ?? t.format} />
          <Row label="Notes" value={t.format_notes} />
          <Row label="Team size" value={t.team_size > 1 ? `${t.team_size} players` : 'Individual'} />
          <Row label="Holes" value={t.holes} />
          <Row label="Flights" value={t.flights} />
          <Row label="Handicap" value={t.handicap_required ? `Required${t.handicap_max != null ? `, max ${t.handicap_max}` : ''}` : (t.handicap_max != null ? `Max ${t.handicap_max}` : 'Not required')} />
          <Row label="Field size" value={[
            t.max_players != null ? `${t.max_players} players` : null,
            t.max_teams != null ? `${t.max_teams} teams` : null,
          ].filter(Boolean).join(', ') || null} />
          <Row label="Waitlist" value={t.waitlist_enabled ? 'Yes, when full' : 'No'} />
        </Section>

        <Section title="Entry fee" style={s.cell}>
          <Row label="Fee" value={t.entry_fee_cents > 0 ? formatMoney(t.entry_fee_cents, t.currency) : 'None'} />
          <Row label="Includes" value={t.fee_includes} />
          <Row label="How to pay" value={t.payment_instructions} />
          <Row label="Payment link" value={t.payment_url} onPress={t.payment_url ? openUrl(t.payment_url) : undefined} />
          <Muted>Payment goes to the organizer directly. Nothing is paid on this site.</Muted>
        </Section>

        <Section title="Rules" style={s.cell}>
          <Row label="Dress code" value={t.dress_code} />
          <Row label="Carts" value={t.cart_policy} />
          <Row label="Mulligans" value={t.mulligans_policy} />
          <Row label="Alcohol" value={t.alcohol_policy} />
          <Row label="Meal" value={t.meal_included ? ['Included', t.meal_notes].filter(Boolean).join('. ') : (t.meal_notes || 'Not included')} />
          <Row label="Waiver" value={t.waiver_required ? 'Signed at registration' : 'Not required'} />
        </Section>

        {(t.prizes || t.sponsors || t.beneficiary) ? (
          <Section title="Prizes and sponsors" style={s.cell}>
            <Row label="Prizes" value={t.prizes} />
            <Row label="Sponsors" value={t.sponsors} />
            <Row label="Supports" value={t.beneficiary} />
          </Section>
        ) : null}

        {(t.contact_name || t.contact_email || t.contact_phone) ? (
          <Section title="Contact" style={s.cell}>
            <Row label="Name" value={t.contact_name} />
            <Row label="Email" value={t.contact_email} onPress={t.contact_email ? () => Linking.openURL(`mailto:${t.contact_email}`).catch(() => {}) : undefined} />
            <Row label="Phone" value={t.contact_phone} onPress={t.contact_phone ? () => Linking.openURL(`tel:${t.contact_phone}`).catch(() => {}) : undefined} />
          </Section>
        ) : null}
      </View>

      {(board.data?.length ?? 0) > 0 ? (
        <Section title="Leaderboard">
          <Leaderboard rows={board.data ?? []} roster={roster.data ?? []} />
        </Section>
      ) : null}

      <Section title={`Players${roster.data && roster.data.length ? ` (${roster.data.length})` : ''}`}>
        {roster.isLoading ? <Loading /> : (roster.data ?? []).length === 0 ? <Muted>No one has registered yet.</Muted> : (
          <Roster rows={roster.data ?? []} />
        )}
      </Section>
    </Page>
  );
}

function Roster({ rows }: { rows: RosterEntry[] }) {
  const s = makeStyles();
  return (
    <View style={s.table}>
      {rows.map((r, i) => (
        <View key={r.id ?? `${r.full_name}-${i}`} style={[s.tr, i > 0 && s.trBorder]}>
          <View style={s.tdMain}>
            <Text style={s.tdName}>{r.full_name}</Text>
            <Text style={s.tdSub}>{[r.rank_title, r.department_name, r.team_name || null].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={s.tdSide}>
            {[r.handicap != null ? `HCP ${r.handicap}` : null, r.status === 'waitlisted' ? 'Waitlist' : r.status === 'checked_in' ? 'Checked in' : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Leaderboard({ rows, roster }: { rows: LeaderboardRow[]; roster: RosterEntry[] }) {
  const s = makeStyles();
  const nameFor = (r: LeaderboardRow) => {
    if (r.team_id) {
      if (r.team_name) return r.team_name;
      const members = roster.filter((p) => p.team_id === r.team_id).map((p) => p.full_name);
      return members.length ? members.join(', ') : 'Team';
    }
    if (r.player_name) return r.player_name;
    const p = roster.find((x) => x.id === r.registration_id);
    return p?.full_name ?? 'Player';
  };
  let pos = 0;
  let prev: string | null = null;
  return (
    <View style={s.table}>
      {rows.map((r, i) => {
        const key = `${r.holes_scored}:${r.total_strokes}`;
        if (key !== prev) pos = i + 1;
        prev = key;
        return (
          <View key={`${r.team_id ?? r.registration_id ?? i}`} style={[s.tr, i > 0 && s.trBorder]}>
            <Text style={s.pos}>{pos}</Text>
            <View style={s.tdMain}><Text style={s.tdName}>{nameFor(r)}</Text></View>
            <Text style={s.tdSide}>{`${r.total_strokes} through ${r.holes_scored}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  panel: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media, padding: Spacing.md, backgroundColor: Colors.surfaceAlt,
  },
  panelText: { gap: Spacing.xxs, flexShrink: 1, minWidth: 220 },
  panelStatus: { fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight, fontWeight: '700', color: Colors.textPrimary },
  panelFacts: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  panelMine: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  panelActions: { flexDirection: 'row', gap: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.xl, rowGap: Spacing.lg },
  cell: { flexGrow: 1, flexBasis: 420, minWidth: 0 },
  subhead: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, fontWeight: '600', color: Colors.textSecondary, marginTop: Spacing.xs },
  schedule: { gap: Spacing.xxs },
  schedRow: { flexDirection: 'row', gap: Spacing.sm },
  schedAt: { width: 90, fontSize: Type.body.size, lineHeight: Type.body.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  schedWhat: { flex: 1, fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  trBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  tdMain: { flex: 1, minWidth: 0 },
  tdName: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  tdSub: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  tdSide: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
  pos: { width: 28, fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary },
}); }
