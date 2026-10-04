/**
 * Tournaments — the client side of nffga_tournaments and friends
 * (docs/NFFGA_CONTRACT.md; columns per migration 104, minus the club
 * scope).
 *
 * Every read degrades quietly: a missing table, a missing view or a
 * refused policy gives an empty list (or null) and a console warning,
 * never a thrown error, so the public pages render before the database
 * is applied.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type {
  Tournament, TournamentStatus, TournamentFormat, NffgaProfile, TournamentEntryMode,
  TournamentPackage, TournamentContest, EventRequest, EventRequestStatus,
} from './types';

// ── Types local to the tournament screens ───────────────────────────

export interface RosterEntry {
  id?: string;
  tournament_id: string;
  player_id?: string | null;
  team_id: string | null;
  status: 'registered' | 'waitlisted' | 'checked_in' | string;
  full_name: string;
  department_name: string | null;
  rank_title: string | null;
  handicap: number | null;
  registered_at?: string | null;
  checked_in_at?: string | null;
  team_name?: string | null;
  /** Migration 107: 'player' (has an account) or 'teammate' (named by a captain). */
  entry_kind?: 'player' | 'teammate';
  is_captain?: boolean;
}

export interface LeaderboardRow {
  tournament_id: string;
  team_id: string | null;
  registration_id: string | null;
  holes_scored: number;
  total_strokes: number;
  last_entry_at?: string | null;
  team_name?: string | null;
  player_name?: string | null;
}

export interface MyRegistration {
  id: string;
  tournament_id: string;
  status: string;
  full_name: string;
  team_id?: string | null;
}

/** One teammate on a team entry (p_players). Only the name is required. */
export interface TeammateInput {
  full_name: string;
  email?: string | null;
  handicap?: number | null;
  department_name?: string | null;
  shirt_size?: ShirtSize | null;
}

/** The fields a player fills in to register (p_details). */
export interface RegistrationDetails {
  full_name: string;
  department_name?: string | null;
  rank_title?: string | null;
  years_of_service?: number | null;
  phone?: string | null;
  email?: string | null;
  handicap?: number | null;
  ghin_number?: string | null;
  preferred_partners?: string | null;
  shirt_size?: ShirtSize | null;
  dietary_notes?: string | null;
  cart_request?: boolean;
  needs_rental_clubs?: boolean;
  accessibility_notes?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  medical_notes?: string | null;
  notes?: string | null;
}

export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL';
export const SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

// ── Labels ───────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: 'Draft',
  registration_open: 'Registration open',
  registration_closed: 'Registration closed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  'draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled',
];

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  scramble: 'Scramble',
  shamble: 'Shamble',
  best_ball: 'Best ball',
  stroke_play: 'Stroke play',
  stableford: 'Stableford',
  match_play: 'Match play',
  alternate_shot: 'Alternate shot',
  other: 'Other',
};
export const TOURNAMENT_FORMATS: TournamentFormat[] = [
  'scramble', 'shamble', 'best_ball', 'stroke_play', 'stableford', 'match_play', 'alternate_shot', 'other',
];

export const START_TYPE_LABEL: Record<Tournament['start_type'], string> = {
  shotgun: 'Shotgun start',
  tee_times: 'Tee times',
};

export const ENTRY_MODE_LABEL: Record<TournamentEntryMode, string> = {
  individual: 'Individual golfers only',
  team: 'Team entries only',
  both: 'Individual golfers or teams',
};
export const ENTRY_MODES: TournamentEntryMode[] = ['both', 'individual', 'team'];

/** "foursome" for 4, "threesome" for 3, "twosome" for 2, else "team of N". */
export function teamWord(size: number): string {
  if (size === 4) return 'foursome';
  if (size === 3) return 'threesome';
  if (size === 2) return 'twosome';
  return `team of ${size}`;
}

export function acceptsIndividuals(t: Pick<Tournament, 'entry_mode'>): boolean {
  return (t.entry_mode ?? 'both') !== 'team';
}
export function acceptsTeams(t: Pick<Tournament, 'entry_mode' | 'team_size'>): boolean {
  return (t.entry_mode ?? 'both') !== 'individual' && t.team_size > 1;
}

/** The sample tournament (supabase/seed/nffga_sample_tournament.sql) and any like it. */
export function isSample(t: Pick<Tournament, 'description'>): boolean {
  return /^\s*Sample event/i.test(t.description ?? '');
}

export const UPCOMING_STATUSES: TournamentStatus[] = ['registration_open', 'registration_closed', 'in_progress'];

export const DEFAULT_TIMEZONE = 'America/New_York';

// ── Quiet failure ────────────────────────────────────────────────────

function quiet(where: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.warn(`[nffga] ${where}:`, (error as any)?.message ?? error);
}

// ── Time zones ───────────────────────────────────────────────────────
// Organizers type local wall-clock times ("2026-10-18 07:30") in the
// tournament's zone; the database stores timestamptz. These convert
// both ways without a date library.

function safeZone(tz: string | null | undefined): string {
  const z = tz || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return z;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function zoneParts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, s: +p.second };
}

function zoneOffsetMs(ms: number, tz: string): number {
  const p = zoneParts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** "YYYY-MM-DD HH:MM" (or "YYYY-MM-DD") in `tz` → ISO UTC. null if unparseable. Empty → null. */
export function localToUtcIso(local: string, tz?: string | null): string | null {
  const m = local.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const zone = safeZone(tz);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  if (Number.isNaN(guess)) return null;
  let ms = guess - zoneOffsetMs(guess, zone);
  ms = guess - zoneOffsetMs(ms, zone);
  return new Date(ms).toISOString();
}

/** ISO → "YYYY-MM-DD HH:MM" wall-clock in `tz`, for form fields. */
export function utcToLocalInput(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const p = zoneParts(ms, safeZone(tz));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${two(p.mo)}-${two(p.d)} ${two(p.h)}:${two(p.mi)}`;
}

/** True when a form value is blank or parses as a local date-time. */
export function isLocalInputValid(v: string): boolean {
  return !v.trim() || localToUtcIso(v) !== null;
}

export function formatWhen(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz), weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(d);
}

export function formatDay(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz), weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(d);
}

export function formatTime(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(tz), hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(d);
}

/** A plain date column ("2026-10-25") as "Sun, Oct 25, 2026". */
export function formatDateOnly(date: string | null | undefined): string {
  if (!date) return '';
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return date;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(d);
}

export function courseCityState(t: Pick<Tournament, 'course_city' | 'course_state'>): string {
  return [t.course_city, t.course_state].filter(Boolean).join(', ');
}

// ── Reads ────────────────────────────────────────────────────────────

type FieldCount = { seats: number; teams: number };

/**
 * Seats taken and team entries per tournament (migration 107's
 * nffga_tournament_field_counts: a team entry holds team_size seats).
 * Falls back to counting roster rows if the view is missing.
 */
async function fieldCounts(ids: string[]): Promise<Record<string, FieldCount>> {
  const out: Record<string, FieldCount> = {};
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from('nffga_tournament_field_counts')
    .select('tournament_id, seats_taken, teams_entered')
    .in('tournament_id', ids);
  if (!error) {
    for (const r of (data ?? []) as { tournament_id: string; seats_taken: number; teams_entered: number }[]) {
      out[r.tournament_id] = { seats: r.seats_taken ?? 0, teams: r.teams_entered ?? 0 };
    }
    return out;
  }
  quiet('field counts', error);
  const roster = await supabase.from('nffga_tournament_roster').select('tournament_id, status').in('tournament_id', ids);
  if (roster.error) { quiet('roster counts', roster.error); return out; }
  for (const r of (roster.data ?? []) as RosterEntry[]) {
    if (r.status === 'registered' || r.status === 'checked_in') {
      const c = out[r.tournament_id] ?? { seats: 0, teams: 0 };
      c.seats += 1;
      out[r.tournament_id] = c;
    }
  }
  return out;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Defaults for columns a pre-107 row may lack, and arrays that must be arrays. */
function normalize(t: Tournament, counts: Record<string, FieldCount>): Tournament {
  return {
    ...t,
    schedule: asArray<{ at: string; what: string }>(t.schedule),
    packages: asArray<TournamentPackage>(t.packages).filter((p) => p && typeof p.name === 'string' && p.name.trim() !== ''),
    contests: asArray<TournamentContest>(t.contests).filter((c) => c && typeof c.name === 'string' && c.name.trim() !== ''),
    entry_mode: t.entry_mode ?? 'both',
    sanctioned: t.sanctioned ?? true,
    registered_count: counts[t.id]?.seats ?? 0,
    teams_entered: counts[t.id]?.teams ?? 0,
  };
}

export async function fetchTournaments(): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_tournaments')
      .select('*')
      .order('starts_at', { ascending: true, nullsFirst: false });
    if (error) { quiet('tournaments', error); return []; }
    const rows = (data ?? []) as Tournament[];
    const counts = await fieldCounts(rows.map((t) => t.id));
    return rows.map((t) => normalize(t, counts));
  } catch (e) {
    quiet('tournaments', e);
    return [];
  }
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase.from('nffga_tournaments').select('*').eq('id', id).maybeSingle();
    if (error) { quiet('tournament', error); return null; }
    if (!data) return null;
    const t = data as Tournament;
    const counts = await fieldCounts([t.id]);
    return normalize(t, counts);
  } catch (e) {
    quiet('tournament', e);
    return null;
  }
}

export async function fetchRoster(tournamentId: string): Promise<RosterEntry[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_tournament_roster')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (error) { quiet('roster', error); return []; }
    const rows = (data ?? []) as RosterEntry[];
    // Seated first, then waitlist; each by name.
    const rank = (s: string) => (s === 'waitlisted' ? 1 : 0);
    return rows.sort((a, b) => rank(a.status) - rank(b.status) || a.full_name.localeCompare(b.full_name));
  } catch (e) {
    quiet('roster', e);
    return [];
  }
}

export async function fetchLeaderboard(tournamentId: string): Promise<LeaderboardRow[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_tournament_leaderboard')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (error) { quiet('leaderboard', error); return []; }
    return ((data ?? []) as LeaderboardRow[])
      .filter((r) => r.holes_scored > 0)
      .sort((a, b) => b.holes_scored - a.holes_scored || a.total_strokes - b.total_strokes);
  } catch (e) {
    quiet('leaderboard', e);
    return [];
  }
}

/** The signed-in player's own registration (RLS lets a player read their row). */
export async function fetchMyRegistration(tournamentId: string, userId: string): Promise<MyRegistration | null> {
  try {
    const { data, error } = await supabase
      .from('nffga_tournament_registrations')
      .select('id, tournament_id, status, full_name, team_id')
      .eq('tournament_id', tournamentId)
      .eq('player_id', userId)
      .maybeSingle();
    if (error) { quiet('my registration', error); return null; }
    return (data as MyRegistration | null) ?? null;
  } catch (e) {
    quiet('my registration', e);
    return null;
  }
}

/** The caller's officer seat (migration 102), or null. */
export async function fetchRole(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('nffga_role_of', { p_user_id: userId });
    if (error) { quiet('role', error); return null; }
    return typeof data === 'string' && data ? data : null;
  } catch (e) {
    quiet('role', e);
    return null;
  }
}

export async function fetchMyProfile(userId: string): Promise<Pick<NffgaProfile, 'display_name' | 'department' | 'rank_title' | 'handicap'> | null> {
  try {
    const { data, error } = await supabase
      .from('nffga_profiles')
      .select('display_name, department, rank_title, handicap')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) { quiet('profile', error); return null; }
    return (data as any) ?? null;
  } catch (e) {
    quiet('profile', e);
    return null;
  }
}

// ── Hooks ────────────────────────────────────────────────────────────

export const tournamentKeys = {
  all: ['nffga', 'tournaments'] as const,
  one: (id: string) => ['nffga', 'tournament', id] as const,
  roster: (id: string) => ['nffga', 'tournament-roster', id] as const,
  leaderboard: (id: string) => ['nffga', 'tournament-leaderboard', id] as const,
  mine: (id: string, userId: string | null) => ['nffga', 'tournament-mine', id, userId] as const,
  role: (userId: string | null) => ['nffga', 'role', userId] as const,
};

export function useTournaments() {
  return useQuery({ queryKey: tournamentKeys.all, queryFn: fetchTournaments });
}

export function useTournament(id: string | undefined) {
  return useQuery({
    queryKey: tournamentKeys.one(id ?? ''),
    queryFn: () => fetchTournament(id as string),
    enabled: !!id,
  });
}

export function useRoster(id: string | undefined) {
  return useQuery({ queryKey: tournamentKeys.roster(id ?? ''), queryFn: () => fetchRoster(id as string), enabled: !!id });
}

export function useLeaderboard(id: string | undefined) {
  return useQuery({ queryKey: tournamentKeys.leaderboard(id ?? ''), queryFn: () => fetchLeaderboard(id as string), enabled: !!id });
}

export function useMyRegistration(id: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: tournamentKeys.mine(id ?? '', userId),
    queryFn: () => fetchMyRegistration(id as string, userId as string),
    enabled: !!id && !!userId,
  });
}

/** The signed-in member's officer role, or null. Signed out → null without a call. */
export function useNffgaRole(userId: string | null) {
  const q = useQuery({
    queryKey: tournamentKeys.role(userId),
    queryFn: () => fetchRole(userId as string),
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  });
  return { role: userId ? (q.data ?? null) : null, loading: !!userId && q.isLoading };
}

/** Upcoming first (soonest first), then past (most recent first), then drafts. */
export function splitTournaments(rows: Tournament[]) {
  const upcoming = rows.filter((t) => UPCOMING_STATUSES.includes(t.status));
  const past = rows
    .filter((t) => t.status === 'completed' || t.status === 'cancelled')
    .sort((a, b) => (b.starts_at ?? '').localeCompare(a.starts_at ?? ''));
  const drafts = rows.filter((t) => t.status === 'draft');
  return { upcoming, past, drafts };
}

/** Team entries still open, or null when there is no team cap. */
export function teamsLeft(t: Tournament): number | null {
  if (t.max_teams == null) return null;
  return Math.max(0, t.max_teams - (t.teams_entered ?? 0));
}

export function spotsLeft(t: Tournament): number | null {
  if (t.max_players == null) return null;
  return Math.max(0, t.max_players - (t.registered_count ?? 0));
}

// ── Writes ───────────────────────────────────────────────────────────

export const REGISTER_ERROR_TEXT: Record<string, string> = {
  not_signed_in: 'Sign in to register.',
  full_name_required: 'Enter your full name.',
  not_found: 'This tournament could not be found.',
  registration_closed: 'Registration is closed for this tournament.',
  not_open_yet: 'Registration has not opened yet.',
  already_registered: 'You are already registered for this tournament.',
  waiver_signature_required: 'Type your full name to sign the waiver.',
  full: 'This tournament is full.',
  teams_only: 'This tournament takes team entries only. Enter a team instead.',
  individuals_only: 'This tournament takes individual golfers only.',
  team_name_required: 'Enter a team name (up to 80 characters).',
  team_name_taken: 'Another team already uses that name. Choose a different one.',
  too_many_players: 'There are more teammates than this tournament allows per team.',
  teammate_name_required: 'Each teammate you list needs a name.',
  teammate_name_too_long: 'A teammate name is too long.',
  bad_handicap: 'A handicap is not valid. Use a number from -10 to 54, like 12.4.',
  bad_email: 'A teammate email address is not valid.',
  bad_shirt_size: 'Choose a shirt size from the list.',
  bad_years: 'Years of service must be a whole number from 0 to 70.',
  bad_players: 'The teammate list could not be read. Try again.',
};

export async function registerForTournament(
  tournamentId: string,
  details: RegistrationDetails,
  signedName: string | null,
): Promise<{ ok: true; registrationId: string; status: string } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_register_for_tournament', {
      p_tournament_id: tournamentId,
      p_details: details,
      p_signed_name: signedName,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null,
    });
    if (error) {
      quiet('register', error);
      return { ok: false, error: 'Registration is not available right now. Try again later.' };
    }
    const r = (data ?? {}) as { ok?: boolean; registration_id?: string; status?: string; error?: string };
    if (!r.ok) {
      return { ok: false, error: REGISTER_ERROR_TEXT[r.error ?? ''] ?? 'Registration did not go through. Try again.' };
    }
    return { ok: true, registrationId: r.registration_id ?? '', status: r.status ?? 'registered' };
  } catch (e) {
    quiet('register', e);
    return { ok: false, error: 'Registration is not available right now. Try again later.' };
  }
}

/** One call: team row, the captain's registration and signature, the named teammates. */
export async function enterTeam(
  tournamentId: string,
  teamName: string,
  teammates: TeammateInput[],
  captain: RegistrationDetails,
  signedName: string | null,
): Promise<{ ok: true; teamId: string; registrationId: string; status: string } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_enter_team', {
      p_tournament_id: tournamentId,
      p_team_name: teamName,
      p_players: teammates,
      p_captain_details: captain,
      p_signed_name: signedName,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null,
    });
    if (error) {
      quiet('enter team', error);
      return { ok: false, error: 'Team entry is not available right now. Try again later.' };
    }
    const r = (data ?? {}) as { ok?: boolean; team_id?: string; registration_id?: string; status?: string; error?: string };
    if (!r.ok) {
      return { ok: false, error: REGISTER_ERROR_TEXT[r.error ?? ''] ?? 'The team entry did not go through. Try again.' };
    }
    return { ok: true, teamId: r.team_id ?? '', registrationId: r.registration_id ?? '', status: r.status ?? 'registered' };
  } catch (e) {
    quiet('enter team', e);
    return { ok: false, error: 'Team entry is not available right now. Try again later.' };
  }
}

export async function withdrawFromTournament(tournamentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_withdraw_from_tournament', { p_tournament_id: tournamentId });
    if (error) { quiet('withdraw', error); return { ok: false, error: 'Could not withdraw right now. Try again later.' }; }
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (!r.ok) {
      const text: Record<string, string> = {
        not_registered: 'You are not registered for this tournament.',
        already_withdrawn: 'You have already withdrawn.',
      };
      return { ok: false, error: text[r.error ?? ''] ?? 'Could not withdraw. Try again.' };
    }
    return { ok: true };
  } catch (e) {
    quiet('withdraw', e);
    return { ok: false, error: 'Could not withdraw right now. Try again later.' };
  }
}

/** Columns the organizer form writes. */
export type TournamentInput = Omit<
  Tournament,
  'id' | 'organizer_id' | 'created_at' | 'updated_at' | 'registered_count' | 'teams_entered' | 'waiver_version' | 'cover_path'
>;

export async function saveTournament(
  input: TournamentInput,
  opts: { id?: string; organizerId: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    if (opts.id) {
      const { error } = await supabase.from('nffga_tournaments').update(input).eq('id', opts.id);
      if (error) { quiet('update tournament', error); return { ok: false, error: friendlyWriteError(error) }; }
      return { ok: true, id: opts.id };
    }
    const { data, error } = await supabase
      .from('nffga_tournaments')
      .insert({ ...input, organizer_id: opts.organizerId })
      .select('id')
      .single();
    if (error || !data) { quiet('create tournament', error); return { ok: false, error: friendlyWriteError(error) }; }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    quiet('save tournament', e);
    return { ok: false, error: 'Could not save right now. Try again later.' };
  }
}

function friendlyWriteError(error: any): string {
  const msg = String(error?.message ?? '');
  const code = String(error?.code ?? '');
  if (code === '42501' || /row-level security/i.test(msg)) return 'Your account cannot make this change.';
  if (code === '42P01' || code === 'PGRST205') return 'Tournaments are not set up on the server yet.';
  if (/tournaments_waiver_text/.test(msg)) return 'Add the waiver text, or turn the waiver off.';
  if (/tournaments_dates/.test(msg)) return 'The end time must be after the start time.';
  if (/tournaments_(packages|contests)_array/.test(msg)) return 'The packages or contests could not be saved. Check those rows.';
  if (/check constraint/i.test(msg)) return 'One of the values is out of range. Check the form and try again.';
  return msg || 'Could not save. Try again.';
}

// ── Event requests (migration 107) ───────────────────────────────────
// A fire department proposes a regional event to be officiated by NFFGA.
// Members read their own; officers read and decide all of them.

export const EVENT_REQUEST_STATUS_LABEL: Record<EventRequestStatus, string> = {
  submitted: 'Submitted',
  reviewing: 'Under review',
  approved: 'Approved',
  declined: 'Declined',
};

export type EventRequestInput = Pick<
  EventRequest,
  | 'department_name' | 'contact_name' | 'contact_email' | 'contact_phone' | 'region' | 'city' | 'state'
  | 'proposed_dates' | 'course_name' | 'course_city' | 'expected_players' | 'format' | 'beneficiary' | 'notes'
>;

export async function fetchMyEventRequests(userId: string): Promise<EventRequest[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_event_requests')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });
    if (error) { quiet('my event requests', error); return []; }
    return (data ?? []) as EventRequest[];
  } catch (e) {
    quiet('my event requests', e);
    return [];
  }
}

/** Every request (officers; RLS returns only the caller's own to anyone else). */
export async function fetchAllEventRequests(): Promise<EventRequest[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_event_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { quiet('event requests', error); return []; }
    return (data ?? []) as EventRequest[];
  } catch (e) {
    quiet('event requests', e);
    return [];
  }
}

export const eventRequestKeys = {
  mine: (userId: string | null) => ['nffga', 'event-requests', 'mine', userId] as const,
  all: ['nffga', 'event-requests', 'all'] as const,
};

export function useMyEventRequests(userId: string | null) {
  return useQuery({
    queryKey: eventRequestKeys.mine(userId),
    queryFn: () => fetchMyEventRequests(userId as string),
    enabled: !!userId,
  });
}

export function useAllEventRequests(enabled: boolean) {
  return useQuery({ queryKey: eventRequestKeys.all, queryFn: fetchAllEventRequests, enabled });
}

export async function submitEventRequest(
  userId: string,
  input: EventRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase
      .from('nffga_event_requests')
      .insert({ ...input, submitted_by: userId })
      .select('id')
      .single();
    if (error || !data) {
      quiet('submit event request', error);
      const code = String((error as any)?.code ?? '');
      if (code === '42501') return { ok: false, error: 'Your account cannot send a request. Sign in with a full account and try again.' };
      if (code === '42P01' || code === 'PGRST205') return { ok: false, error: 'Event requests are not set up on the server yet.' };
      if (code === '23514') return { ok: false, error: 'One of the values is too long or out of range. Check the form and try again.' };
      return { ok: false, error: 'The request could not be sent. Try again.' };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (e) {
    quiet('submit event request', e);
    return { ok: false, error: 'The request could not be sent right now. Try again later.' };
  }
}

/** Officers: create a draft tournament from the request and mark it approved. */
export async function approveEventRequest(
  requestId: string,
): Promise<{ ok: true; tournamentId: string } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.rpc('nffga_create_tournament_from_request', { p_request_id: requestId });
    if (error) { quiet('approve request', error); return { ok: false, error: 'Could not approve right now. Try again later.' }; }
    const r = (data ?? {}) as { ok?: boolean; tournament_id?: string; error?: string };
    if (!r.ok || !r.tournament_id) {
      const text: Record<string, string> = {
        not_allowed: 'Only association officers can approve event requests.',
        not_found: 'This request could not be found.',
      };
      return { ok: false, error: text[r.error ?? ''] ?? 'Could not approve. Try again.' };
    }
    return { ok: true, tournamentId: r.tournament_id };
  } catch (e) {
    quiet('approve request', e);
    return { ok: false, error: 'Could not approve right now. Try again later.' };
  }
}

/** Officers: set a request's status, with an optional note the submitter can read. */
export async function setEventRequestStatus(
  requestId: string,
  status: Exclude<EventRequestStatus, 'approved'>,
  note?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const patch: { status: string; officer_notes?: string | null } = { status };
    if (note !== undefined) patch.officer_notes = note;
    const { data, error } = await supabase
      .from('nffga_event_requests')
      .update(patch)
      .eq('id', requestId)
      .select('id');
    if (error) { quiet('update request', error); return { ok: false, error: 'Could not update the request. Try again.' }; }
    if (!data || data.length === 0) return { ok: false, error: 'Only association officers can change a request.' };
    return { ok: true };
  } catch (e) {
    quiet('update request', e);
    return { ok: false, error: 'Could not update the request right now. Try again later.' };
  }
}
