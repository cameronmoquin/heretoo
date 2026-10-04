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
import type { Tournament, TournamentStatus, TournamentFormat, NffgaProfile } from './types';

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

/** Seated players (registered or checked in) per tournament. */
async function seatedCounts(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from('nffga_tournament_roster')
    .select('*')
    .in('tournament_id', ids);
  if (error) { quiet('roster counts', error); return out; }
  for (const r of (data ?? []) as RosterEntry[]) {
    if (r.status === 'registered' || r.status === 'checked_in') {
      out[r.tournament_id] = (out[r.tournament_id] ?? 0) + 1;
    }
  }
  return out;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from('nffga_tournaments')
      .select('*')
      .order('starts_at', { ascending: true, nullsFirst: false });
    if (error) { quiet('tournaments', error); return []; }
    const rows = (data ?? []) as Tournament[];
    const counts = await seatedCounts(rows.map((t) => t.id));
    return rows.map((t) => ({ ...t, schedule: Array.isArray(t.schedule) ? t.schedule : [], registered_count: counts[t.id] ?? 0 }));
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
    const counts = await seatedCounts([t.id]);
    return { ...t, schedule: Array.isArray(t.schedule) ? t.schedule : [], registered_count: counts[t.id] ?? 0 };
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
      .select('id, tournament_id, status, full_name')
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
  'id' | 'organizer_id' | 'created_at' | 'updated_at' | 'registered_count' | 'waiver_version' | 'cover_path'
>;

export async function saveTournament(
  input: TournamentInput,
  opts: { id?: string; organizerId: string },
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
  if (/check constraint/i.test(msg)) return 'One of the values is out of range. Check the form and try again.';
  return msg || 'Could not save. Try again.';
}
