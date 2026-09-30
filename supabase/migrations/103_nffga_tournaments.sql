-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 103: Tournaments, registration, waivers, scoring
-- ════════════════════════════════════════════════════════════════════════
-- A TOURNAMENT is one event at one course on one day (or a range). It
-- carries every logistical fact a player needs before they show up and
-- every fact an organizer needs to run the day: where, when, format,
-- fee, what the fee buys, capacity, check-in, start type, cart and
-- dress rules, the rain plan, and who to call.
--
-- PEOPLE. The creator is the organizer. A host club's owner can also
-- run it. Organizers may add STAFF (co-organizers, scorers). National
-- events with no host club are run by NFFGA OFFICERS, a table nothing
-- with a user JWT can write — the same "not guarded, incapable" shape
-- as 098's human_verifications.
--
-- REGISTRATION goes through one RPC that, in a single transaction,
-- checks the window and capacity, seats the player (or waitlists
-- them), records their logistics (handicap, shirt, diet, emergency
-- contact, department) and captures the WAIVER signature. A player
-- cannot end up registered without a signed waiver when one is
-- required, because there is no other insert path.
--
-- THE WAIVER is evidence. The signature row stores the exact text
-- version signed, a SHA-256 of that text, the name the player typed,
-- the moment, and what the client reported about itself. The table is
-- append-only: a trigger refuses UPDATE and DELETE for every role,
-- including the service role, so a signature can never be edited
-- after the fact. (Same discipline as Car56's investigation_audit.) The
-- waiver TEXT itself is the organizer's — a default draft ships in
-- constants/waiver.ts and must be reviewed by counsel before a real
-- event uses it.
--
-- SCORING is hole-by-hole rows keyed to a registration (individual
-- formats) or a team (scramble, best ball). Organizers and scorers
-- write; every registered player reads. Leaderboards are a query, not
-- a table.
--
-- NO MONEY MOVES HERE either. The entry fee is recorded and marked paid
-- by the organizer; collection is Stripe Checkout or cash at the tent,
-- the organizer's choice. See 102's header for the reasoning.
--
-- EMSPCR. This project's database already models firefighters,
-- agencies and apparatus. department_name is freeform for now; when
-- the two schemas are wired it becomes a reference to agencies.
--
-- Depends on: 001, 083, 102 (is_active_club_member).
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Preconditions ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.families') is null then
    raise exception 'profiles / families missing: migration 001 has not run here.';
  end if;
  if to_regprocedure('public.uid_is_guest()') is null then
    raise exception 'public.uid_is_guest() missing: migration 083 has not run here.';
  end if;
  if to_regprocedure('public.is_active_club_member(uuid, uuid)') is null then
    raise exception 'public.is_active_club_member() missing: migration 102 has not run here.';
  end if;
end$$;

create extension if not exists "pgcrypto";


-- ── 1. NFFGA officers — the national desk ────────────────────────────
-- Inserted by the service role or the SQL editor. No client write path.
create table if not exists public.nffga_officers (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  role        text not null check (role in ('president', 'director', 'tournament_chair', 'treasurer', 'secretary', 'admin')),
  created_at  timestamptz not null default now()
);
alter table public.nffga_officers enable row level security;

drop policy if exists nffga_officers_read on public.nffga_officers;
create policy nffga_officers_read on public.nffga_officers
  for select to authenticated using (true);
-- Deliberately no insert / update / delete policy.

create or replace function public.is_nffga_officer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nffga_officers where user_id = p_profile_id);
$$;
revoke all on function public.is_nffga_officer(uuid) from public, anon;
grant execute on function public.is_nffga_officer(uuid) to authenticated;


-- ── 2. Tournaments ───────────────────────────────────────────────────

create table if not exists public.tournaments (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid not null references public.profiles(id) on delete restrict,
  -- Null for a national event run by officers.
  host_club_id          uuid references public.families(id) on delete set null,
  scope                 text not null default 'public' check (scope in ('public', 'club')),
  status                text not null default 'draft'
                        check (status in ('draft', 'registration_open', 'registration_closed',
                                          'in_progress', 'completed', 'cancelled')),

  -- What it is
  name                  text not null check (char_length(name) between 3 and 140),
  description           text check (char_length(description) <= 8000),
  format                text not null default 'scramble'
                        check (format in ('scramble', 'shamble', 'best_ball', 'stroke_play',
                                          'stableford', 'match_play', 'alternate_shot', 'other')),
  format_notes          text,
  team_size             smallint not null default 4 check (team_size between 1 and 6),
  holes                 smallint not null default 18 check (holes in (9, 18, 27, 36)),
  flights               text,                 -- "A/B/C by handicap", freeform
  handicap_required     boolean not null default false,
  handicap_max          numeric(4,1),
  beneficiary           text,                 -- charity or fund the event supports

  -- Where
  course_name           text,
  course_address        text,
  course_city           text,
  course_state          text,
  course_postal         text,
  course_phone          text,
  course_url            text,
  lat                   double precision,
  lng                   double precision,

  -- When
  timezone              text not null default 'America/New_York',
  starts_at             timestamptz,
  ends_at               timestamptz,
  check_in_at           timestamptz,
  start_type            text not null default 'shotgun' check (start_type in ('shotgun', 'tee_times')),
  tee_interval_min      smallint check (tee_interval_min is null or tee_interval_min between 5 and 20),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  rain_date             date,
  rain_policy           text,

  -- Capacity
  max_players           integer check (max_players is null or max_players > 0),
  max_teams             integer check (max_teams is null or max_teams > 0),
  waitlist_enabled      boolean not null default true,

  -- Money (recorded, not moved)
  entry_fee_cents       integer not null default 0 check (entry_fee_cents >= 0),
  currency              text not null default 'USD',
  fee_includes          text,                 -- "green fee, cart, lunch, two mulligans"
  payment_instructions  text,                 -- how to pay: link, Venmo handle, cash at check-in
  payment_url           text,

  -- Rules of the day
  dress_code            text,
  cart_policy           text,
  mulligans_policy      text,
  alcohol_policy        text,
  meal_included         boolean not null default false,
  meal_notes            text,
  prizes                text,
  sponsors              text,
  schedule              jsonb not null default '[]'::jsonb,  -- [{ "at": "07:00", "what": "Registration opens" }, ...]

  -- Contacts
  contact_name          text,
  contact_email         text,
  contact_phone         text,

  -- Waiver
  waiver_required       boolean not null default true,
  waiver_text           text,
  waiver_version        integer not null default 1 check (waiver_version >= 1),

  -- Media
  cover_path            text,                 -- bucket tournament-media
  public_notes          text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint tournaments_club_scope check (scope = 'public' or host_club_id is not null),
  constraint tournaments_waiver_text check (not waiver_required or status = 'draft' or waiver_text is not null),
  constraint tournaments_dates check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

drop trigger if exists tournaments_updated_at on public.tournaments;
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function public.set_updated_at();

-- Bumping waiver_text after signatures exist must bump the version, or
-- old signatures would appear to cover new words.
create or replace function public.tournaments_waiver_version_guard()
returns trigger language plpgsql as $$
begin
  if new.waiver_text is distinct from old.waiver_text
     and new.waiver_version = old.waiver_version
     and exists (select 1 from public.tournament_waiver_signatures s
                 where s.tournament_id = old.id and s.waiver_version = old.waiver_version) then
    new.waiver_version := old.waiver_version + 1;
  end if;
  return new;
end; $$;

create index if not exists tournaments_organizer_idx on public.tournaments(organizer_id);
create index if not exists tournaments_club_idx      on public.tournaments(host_club_id) where host_club_id is not null;
create index if not exists tournaments_upcoming_idx  on public.tournaments(starts_at) where status in ('registration_open', 'registration_closed', 'in_progress');


-- ── 3. Staff ─────────────────────────────────────────────────────────

create table if not exists public.tournament_staff (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'organizer' check (role in ('organizer', 'scorer', 'volunteer')),
  added_by      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);

-- The creator is staff from the first moment.
create or replace function public.tournaments_add_organizer_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tournament_staff (tournament_id, profile_id, role, added_by)
  values (new.id, new.organizer_id, 'organizer', new.organizer_id)
  on conflict do nothing;
  return new;
end; $$;
drop trigger if exists tournaments_add_organizer_staff_trg on public.tournaments;
create trigger tournaments_add_organizer_staff_trg
  after insert on public.tournaments
  for each row execute function public.tournaments_add_organizer_staff();

-- Who may run this tournament: the organizer, an organizer-role staff
-- member, the host club's owner, or an NFFGA officer.
create or replace function public.can_manage_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tournaments t
    left join public.families c on c.id = t.host_club_id
    where t.id = p_tournament_id
      and (t.organizer_id = p_profile_id
           or c.owner_id = p_profile_id
           or public.is_nffga_officer(p_profile_id)
           or exists (select 1 from public.tournament_staff s
                      where s.tournament_id = t.id and s.profile_id = p_profile_id and s.role = 'organizer'))
  );
$$;
revoke all on function public.can_manage_tournament(uuid, uuid) from public, anon;
grant execute on function public.can_manage_tournament(uuid, uuid) to authenticated;

-- Who may enter scores: managers plus scorer-role staff.
create or replace function public.can_score_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_manage_tournament(p_tournament_id, p_profile_id)
      or exists (select 1 from public.tournament_staff s
                 where s.tournament_id = p_tournament_id and s.profile_id = p_profile_id and s.role = 'scorer');
$$;
revoke all on function public.can_score_tournament(uuid, uuid) from public, anon;
grant execute on function public.can_score_tournament(uuid, uuid) to authenticated;

-- Who may see it: public ones once out of draft; club ones to members;
-- anyone who can manage it, at any status.
create or replace function public.can_view_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id
      and (public.can_manage_tournament(t.id, p_profile_id)
           or (t.status <> 'draft' and (
                 t.scope = 'public'
                 or public.is_active_club_member(t.host_club_id, p_profile_id))))
  );
$$;
revoke all on function public.can_view_tournament(uuid, uuid) from public, anon;
grant execute on function public.can_view_tournament(uuid, uuid) to authenticated;


-- ── 4. Teams and registrations ───────────────────────────────────────

create table if not exists public.tournament_teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  captain_id    uuid references public.profiles(id) on delete set null,
  department_name text,
  created_at    timestamptz not null default now(),
  unique (tournament_id, name)
);
create index if not exists tournament_teams_tournament_idx on public.tournament_teams(tournament_id);

create table if not exists public.tournament_registrations (
  id                      uuid primary key default gen_random_uuid(),
  tournament_id           uuid not null references public.tournaments(id) on delete cascade,
  player_id               uuid not null references public.profiles(id) on delete cascade,
  team_id                 uuid references public.tournament_teams(id) on delete set null,
  status                  text not null default 'registered'
                          check (status in ('registered', 'waitlisted', 'withdrawn', 'checked_in', 'no_show', 'disqualified')),

  -- Who is playing
  full_name               text not null,       -- as it should appear on the sheet
  department_name         text,
  rank_title              text,
  years_of_service        smallint check (years_of_service is null or years_of_service between 0 and 70),
  phone                   text,
  email                   text,

  -- Golf
  handicap                numeric(4,1),
  ghin_number             text,
  preferred_partners      text,                -- "put me with Station 4", freeform

  -- Logistics
  shirt_size              text check (shirt_size is null or shirt_size in ('XS','S','M','L','XL','XXL','XXXL')),
  dietary_notes           text,
  cart_request            boolean not null default true,
  needs_rental_clubs      boolean not null default false,
  accessibility_notes     text,

  -- Emergency
  emergency_contact_name  text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  medical_notes           text,                -- allergies, conditions; organizer eyes only via RLS below

  -- Money (recorded, not moved)
  paid                    boolean not null default false,
  paid_cents              integer check (paid_cents is null or paid_cents >= 0),
  payment_ref             text,
  paid_at                 timestamptz,

  notes                   text,
  registered_at           timestamptz not null default now(),
  checked_in_at           timestamptz,
  withdrawn_at            timestamptz,
  unique (tournament_id, player_id)
);
create index if not exists tournament_registrations_tournament_idx on public.tournament_registrations(tournament_id, status);
create index if not exists tournament_registrations_player_idx     on public.tournament_registrations(player_id);
create index if not exists tournament_registrations_team_idx       on public.tournament_registrations(team_id) where team_id is not null;

-- A team belongs to the same tournament as its players.
create or replace function public.tournament_registrations_team_guard()
returns trigger language plpgsql as $$
begin
  if new.team_id is not null and not exists (
    select 1 from public.tournament_teams tt where tt.id = new.team_id and tt.tournament_id = new.tournament_id
  ) then
    raise exception 'team % is not in tournament %', new.team_id, new.tournament_id;
  end if;
  return new;
end; $$;
drop trigger if exists tournament_registrations_team_guard_trg on public.tournament_registrations;
create trigger tournament_registrations_team_guard_trg
  before insert or update of team_id on public.tournament_registrations
  for each row execute function public.tournament_registrations_team_guard();


-- ── 5. Waiver signatures — append-only evidence ──────────────────────

create table if not exists public.tournament_waiver_signatures (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete restrict,
  registration_id uuid not null references public.tournament_registrations(id) on delete restrict,
  player_id       uuid not null references public.profiles(id) on delete restrict,
  waiver_version  integer not null,
  waiver_text     text not null,           -- the exact words, frozen
  waiver_sha256   text not null,           -- hex digest of waiver_text
  signed_name     text not null check (char_length(signed_name) between 2 and 120),
  agreed          boolean not null check (agreed),
  signed_at       timestamptz not null default now(),
  user_agent      text,
  client_ip       inet,
  unique (registration_id, waiver_version)
);
create index if not exists tournament_waiver_signatures_tournament_idx on public.tournament_waiver_signatures(tournament_id);

-- Nobody edits a signature. Not the player, not the organizer, not the
-- service role. A wrong signature is superseded by a new row at a new
-- version, never corrected in place.
create or replace function public.refuse_signature_change()
returns trigger language plpgsql as $$
begin
  raise exception 'tournament_waiver_signatures is append-only (% refused)', tg_op;
end; $$;
drop trigger if exists tournament_waiver_signatures_immutable on public.tournament_waiver_signatures;
create trigger tournament_waiver_signatures_immutable
  before update or delete on public.tournament_waiver_signatures
  for each row execute function public.refuse_signature_change();

-- Now that the signatures table exists, attach the version guard.
drop trigger if exists tournaments_waiver_version_guard_trg on public.tournaments;
create trigger tournaments_waiver_version_guard_trg
  before update of waiver_text on public.tournaments
  for each row execute function public.tournaments_waiver_version_guard();


-- ── 6. Tee sheet and scores ──────────────────────────────────────────

create table if not exists public.tournament_tee_times (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  team_id         uuid references public.tournament_teams(id) on delete cascade,
  registration_id uuid references public.tournament_registrations(id) on delete cascade,
  starting_hole   smallint not null default 1 check (starting_hole between 1 and 18),
  position        text,                    -- "A" / "B" when two groups share a hole on a shotgun
  tee_at          timestamptz,             -- for tee-time starts
  group_number    smallint,
  notes           text,
  constraint tournament_tee_times_one_subject check (
    (team_id is not null)::int + (registration_id is not null)::int = 1
  )
);
create index if not exists tournament_tee_times_tournament_idx on public.tournament_tee_times(tournament_id);

create table if not exists public.tournament_scores (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  team_id         uuid references public.tournament_teams(id) on delete cascade,
  registration_id uuid references public.tournament_registrations(id) on delete cascade,
  hole            smallint not null check (hole between 1 and 36),
  strokes         smallint not null check (strokes between 1 and 20),
  entered_by      uuid references public.profiles(id) on delete set null,
  entered_at      timestamptz not null default now(),
  constraint tournament_scores_one_subject check (
    (team_id is not null)::int + (registration_id is not null)::int = 1
  )
);
create unique index if not exists tournament_scores_team_hole_idx
  on public.tournament_scores(tournament_id, team_id, hole) where team_id is not null;
create unique index if not exists tournament_scores_player_hole_idx
  on public.tournament_scores(tournament_id, registration_id, hole) where registration_id is not null;

-- Totals, for the leaderboard. Ties are the app's problem to break.
create or replace view public.tournament_leaderboard as
  select s.tournament_id, s.team_id, s.registration_id,
         count(*)::int as holes_scored,
         sum(s.strokes)::int as total_strokes,
         max(s.entered_at) as last_entry_at
  from public.tournament_scores s
  group by s.tournament_id, s.team_id, s.registration_id;


-- ── 7. RLS ───────────────────────────────────────────────────────────

alter table public.tournaments                  enable row level security;
alter table public.tournament_staff             enable row level security;
alter table public.tournament_teams             enable row level security;
alter table public.tournament_registrations     enable row level security;
alter table public.tournament_waiver_signatures enable row level security;
alter table public.tournament_tee_times         enable row level security;
alter table public.tournament_scores            enable row level security;

-- Tournaments
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments
  for select to authenticated
  using (public.can_view_tournament(id, auth.uid()));

drop policy if exists tournaments_insert on public.tournaments;
create policy tournaments_insert on public.tournaments
  for insert to authenticated
  with check (
    organizer_id = auth.uid()
    and (host_club_id is null
         or public.is_active_club_member(host_club_id, auth.uid()))
    -- A national (no-club) event needs an officer.
    and (host_club_id is not null or public.is_nffga_officer(auth.uid()))
  );

drop policy if exists tournaments_update on public.tournaments;
create policy tournaments_update on public.tournaments
  for update to authenticated
  using (public.can_manage_tournament(id, auth.uid()))
  with check (public.can_manage_tournament(id, auth.uid()));

-- Drafts can be deleted; anything a player may have signed up for is
-- cancelled instead, so registrations and signatures survive.
drop policy if exists tournaments_delete on public.tournaments;
create policy tournaments_delete on public.tournaments
  for delete to authenticated
  using (status = 'draft' and public.can_manage_tournament(id, auth.uid()));

drop policy if exists tournaments_no_guests on public.tournaments;
create policy tournaments_no_guests on public.tournaments
  as restrictive for insert to authenticated
  with check (not public.uid_is_guest());

-- Staff: managers read and write; a staffer sees their own row.
drop policy if exists tournament_staff_read on public.tournament_staff;
create policy tournament_staff_read on public.tournament_staff
  for select to authenticated
  using (profile_id = auth.uid() or public.can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_staff_write on public.tournament_staff;
create policy tournament_staff_write on public.tournament_staff
  for all to authenticated
  using (public.can_manage_tournament(tournament_id, auth.uid()))
  with check (public.can_manage_tournament(tournament_id, auth.uid()));

-- Teams: anyone who can see the tournament sees the teams; managers
-- write; a registered player may create a team and captain it.
drop policy if exists tournament_teams_read on public.tournament_teams;
create policy tournament_teams_read on public.tournament_teams
  for select to authenticated
  using (public.can_view_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_teams_manage on public.tournament_teams;
create policy tournament_teams_manage on public.tournament_teams
  for all to authenticated
  using (public.can_manage_tournament(tournament_id, auth.uid()))
  with check (public.can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_teams_captain_insert on public.tournament_teams;
create policy tournament_teams_captain_insert on public.tournament_teams
  for insert to authenticated
  with check (
    captain_id = auth.uid()
    and exists (select 1 from public.tournament_registrations r
                where r.tournament_id = tournament_teams.tournament_id
                  and r.player_id = auth.uid() and r.status in ('registered', 'checked_in'))
  );

drop policy if exists tournament_teams_captain_update on public.tournament_teams;
create policy tournament_teams_captain_update on public.tournament_teams
  for update to authenticated
  using (captain_id = auth.uid()) with check (captain_id = auth.uid());

-- Registrations. A player sees their own row in full. Managers see every
-- row in full. Other registered players see the roster through the
-- tournament_roster view below, which carries no medical, contact or
-- payment columns — the table itself never resolves for them.
drop policy if exists tournament_registrations_read on public.tournament_registrations;
create policy tournament_registrations_read on public.tournament_registrations
  for select to authenticated
  using (player_id = auth.uid() or public.can_manage_tournament(tournament_id, auth.uid()));

-- No direct insert. register_for_tournament() is the only way in, so
-- the window, capacity and waiver are never skipped.

-- A player edits their own logistics; status, paid and team are the
-- organizer's, held fixed by the trigger below.
drop policy if exists tournament_registrations_self_update on public.tournament_registrations;
create policy tournament_registrations_self_update on public.tournament_registrations
  for update to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

drop policy if exists tournament_registrations_manage on public.tournament_registrations;
create policy tournament_registrations_manage on public.tournament_registrations
  for update to authenticated
  using (public.can_manage_tournament(tournament_id, auth.uid()))
  with check (public.can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_registrations_manage_delete on public.tournament_registrations;
create policy tournament_registrations_manage_delete on public.tournament_registrations
  for delete to authenticated
  using (public.can_manage_tournament(tournament_id, auth.uid())
         and not exists (select 1 from public.tournament_waiver_signatures s where s.registration_id = id));

-- The columns a player may not touch on their own row.
create or replace function public.tournament_registrations_player_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.player_id and not public.can_manage_tournament(old.tournament_id, auth.uid()) then
    if new.status is distinct from old.status
       or new.paid is distinct from old.paid
       or new.paid_cents is distinct from old.paid_cents
       or new.payment_ref is distinct from old.payment_ref
       or new.paid_at is distinct from old.paid_at
       or new.team_id is distinct from old.team_id
       or new.tournament_id is distinct from old.tournament_id
       or new.player_id is distinct from old.player_id
       or new.checked_in_at is distinct from old.checked_in_at then
      raise exception 'players may not change status, payment, team or identity on a registration';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists tournament_registrations_player_guard_trg on public.tournament_registrations;
create trigger tournament_registrations_player_guard_trg
  before update on public.tournament_registrations
  for each row execute function public.tournament_registrations_player_guard();

-- The roster other players see. security_invoker is OFF on purpose:
-- the view is the door through the table's RLS, and it exposes only
-- the columns a fellow player has any business seeing.
create or replace view public.tournament_roster
  with (security_invoker = false) as
  select r.id, r.tournament_id, r.player_id, r.team_id, r.status,
         r.full_name, r.department_name, r.rank_title, r.handicap,
         r.registered_at, r.checked_in_at
  from public.tournament_registrations r
  where r.status in ('registered', 'waitlisted', 'checked_in')
    and public.can_view_tournament(r.tournament_id, auth.uid());
revoke all on public.tournament_roster from public, anon;
grant select on public.tournament_roster to authenticated;

-- Waiver signatures: the player reads their own; managers read all.
-- No insert policy — register_for_tournament() writes them.
drop policy if exists tournament_waiver_signatures_read on public.tournament_waiver_signatures;
create policy tournament_waiver_signatures_read on public.tournament_waiver_signatures
  for select to authenticated
  using (player_id = auth.uid() or public.can_manage_tournament(tournament_id, auth.uid()));

-- Tee times: viewers read; managers write.
drop policy if exists tournament_tee_times_read on public.tournament_tee_times;
create policy tournament_tee_times_read on public.tournament_tee_times
  for select to authenticated
  using (public.can_view_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_tee_times_write on public.tournament_tee_times;
create policy tournament_tee_times_write on public.tournament_tee_times
  for all to authenticated
  using (public.can_manage_tournament(tournament_id, auth.uid()))
  with check (public.can_manage_tournament(tournament_id, auth.uid()));

-- Scores: viewers read; scorers and managers write.
drop policy if exists tournament_scores_read on public.tournament_scores;
create policy tournament_scores_read on public.tournament_scores
  for select to authenticated
  using (public.can_view_tournament(tournament_id, auth.uid()));

drop policy if exists tournament_scores_write on public.tournament_scores;
create policy tournament_scores_write on public.tournament_scores
  for all to authenticated
  using (public.can_score_tournament(tournament_id, auth.uid()))
  with check (public.can_score_tournament(tournament_id, auth.uid()) and entered_by = auth.uid());

-- The leaderboard view rides the scores' RLS.
alter view public.tournament_leaderboard set (security_invoker = true);
revoke all on public.tournament_leaderboard from public, anon;
grant select on public.tournament_leaderboard to authenticated;


-- ── 8. Registration, in one transaction ──────────────────────────────
-- p_details carries the logistics columns by name (full_name required).
-- p_signed_name is the typed signature; required when the tournament
-- requires a waiver. Returns the registration row's id and status.
create or replace function public.register_for_tournament(
  p_tournament_id uuid,
  p_details       jsonb,
  p_signed_name   text default null,
  p_user_agent    text default null
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t        public.tournaments;
  uid      uuid := auth.uid();
  seated   integer;
  new_status text;
  reg_id   uuid;
  fname    text := nullif(btrim(coalesce(p_details->>'full_name', '')), '');
begin
  if uid is null or public.uid_is_guest() then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if fname is null then
    return jsonb_build_object('ok', false, 'error', 'full_name_required');
  end if;

  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found or not public.can_view_tournament(t.id, uid) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if t.status <> 'registration_open' then
    return jsonb_build_object('ok', false, 'error', 'registration_closed');
  end if;
  if t.registration_opens_at is not null and now() < t.registration_opens_at then
    return jsonb_build_object('ok', false, 'error', 'not_open_yet');
  end if;
  if t.registration_closes_at is not null and now() > t.registration_closes_at then
    return jsonb_build_object('ok', false, 'error', 'registration_closed');
  end if;
  if exists (select 1 from public.tournament_registrations r
             where r.tournament_id = t.id and r.player_id = uid and r.status <> 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;
  if t.waiver_required and (t.waiver_text is null or nullif(btrim(coalesce(p_signed_name, '')), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'waiver_signature_required');
  end if;

  -- Capacity: seated players count; waitlisted do not.
  select count(*) into seated from public.tournament_registrations r
    where r.tournament_id = t.id and r.status in ('registered', 'checked_in');
  if t.max_players is not null and seated >= t.max_players then
    if not t.waitlist_enabled then
      return jsonb_build_object('ok', false, 'error', 'full');
    end if;
    new_status := 'waitlisted';
  else
    new_status := 'registered';
  end if;

  -- A previously withdrawn row is reused so the unique key holds.
  insert into public.tournament_registrations as r (
    tournament_id, player_id, status, full_name, department_name, rank_title,
    years_of_service, phone, email, handicap, ghin_number, preferred_partners,
    shirt_size, dietary_notes, cart_request, needs_rental_clubs, accessibility_notes,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    medical_notes, notes
  ) values (
    t.id, uid, new_status, fname,
    p_details->>'department_name', p_details->>'rank_title',
    (p_details->>'years_of_service')::smallint,
    p_details->>'phone', p_details->>'email',
    (p_details->>'handicap')::numeric, p_details->>'ghin_number', p_details->>'preferred_partners',
    p_details->>'shirt_size', p_details->>'dietary_notes',
    coalesce((p_details->>'cart_request')::boolean, true),
    coalesce((p_details->>'needs_rental_clubs')::boolean, false),
    p_details->>'accessibility_notes',
    p_details->>'emergency_contact_name', p_details->>'emergency_contact_phone',
    p_details->>'emergency_contact_relation',
    p_details->>'medical_notes', p_details->>'notes'
  )
  on conflict (tournament_id, player_id) do update set
    status = excluded.status, full_name = excluded.full_name,
    department_name = excluded.department_name, rank_title = excluded.rank_title,
    years_of_service = excluded.years_of_service, phone = excluded.phone, email = excluded.email,
    handicap = excluded.handicap, ghin_number = excluded.ghin_number,
    preferred_partners = excluded.preferred_partners, shirt_size = excluded.shirt_size,
    dietary_notes = excluded.dietary_notes, cart_request = excluded.cart_request,
    needs_rental_clubs = excluded.needs_rental_clubs, accessibility_notes = excluded.accessibility_notes,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    emergency_contact_relation = excluded.emergency_contact_relation,
    medical_notes = excluded.medical_notes, notes = excluded.notes,
    registered_at = now(), withdrawn_at = null, team_id = null
  returning r.id into reg_id;

  if t.waiver_required then
    insert into public.tournament_waiver_signatures (
      tournament_id, registration_id, player_id, waiver_version, waiver_text,
      waiver_sha256, signed_name, agreed, user_agent
    ) values (
      t.id, reg_id, uid, t.waiver_version, t.waiver_text,
      encode(digest(convert_to(t.waiver_text, 'UTF8'), 'sha256'), 'hex'),
      btrim(p_signed_name), true, p_user_agent
    )
    on conflict (registration_id, waiver_version) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'registration_id', reg_id, 'status', new_status);
end; $$;
revoke all on function public.register_for_tournament(uuid, jsonb, text, text) from public, anon;
grant execute on function public.register_for_tournament(uuid, jsonb, text, text) to authenticated;

-- Withdraw, and promote the first waitlisted player if a seat opened.
create or replace function public.withdraw_from_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.tournament_registrations;
  promoted uuid;
begin
  select * into r from public.tournament_registrations
    where tournament_id = p_tournament_id and player_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_registered'); end if;
  if r.status in ('withdrawn', 'disqualified') then
    return jsonb_build_object('ok', false, 'error', 'already_withdrawn');
  end if;

  update public.tournament_registrations
    set status = 'withdrawn', withdrawn_at = now(), team_id = null where id = r.id;

  if r.status in ('registered', 'checked_in') then
    update public.tournament_registrations
      set status = 'registered'
      where id = (select id from public.tournament_registrations
                  where tournament_id = p_tournament_id and status = 'waitlisted'
                  order by registered_at limit 1)
      returning player_id into promoted;
  end if;

  return jsonb_build_object('ok', true, 'promoted_player_id', promoted);
end; $$;
revoke all on function public.withdraw_from_tournament(uuid) from public, anon;
grant execute on function public.withdraw_from_tournament(uuid) to authenticated;

-- Organizer's check-in.
create or replace function public.check_in_player(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.tournament_registrations;
begin
  select * into r from public.tournament_registrations where id = p_registration_id for update;
  if not found or not public.can_manage_tournament(r.tournament_id, auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if r.status not in ('registered', 'waitlisted') then
    return jsonb_build_object('ok', false, 'error', 'not_checkable', 'status', r.status);
  end if;
  update public.tournament_registrations
    set status = 'checked_in', checked_in_at = now() where id = r.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.check_in_player(uuid) from public, anon;
grant execute on function public.check_in_player(uuid) to authenticated;

-- Has this player signed the CURRENT waiver? The app asks before the
-- tee sheet, because a waiver revised after registration needs a new
-- signature.
create or replace function public.sign_tournament_waiver(
  p_tournament_id uuid,
  p_signed_name   text,
  p_user_agent    text default null
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  t public.tournaments;
  r public.tournament_registrations;
begin
  select * into t from public.tournaments where id = p_tournament_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from public.tournament_registrations
    where tournament_id = t.id and player_id = auth.uid() and status <> 'withdrawn';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_registered'); end if;
  if t.waiver_text is null then return jsonb_build_object('ok', false, 'error', 'no_waiver'); end if;
  if nullif(btrim(coalesce(p_signed_name, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'signature_required');
  end if;

  insert into public.tournament_waiver_signatures (
    tournament_id, registration_id, player_id, waiver_version, waiver_text,
    waiver_sha256, signed_name, agreed, user_agent
  ) values (
    t.id, r.id, auth.uid(), t.waiver_version, t.waiver_text,
    encode(digest(convert_to(t.waiver_text, 'UTF8'), 'sha256'), 'hex'),
    btrim(p_signed_name), true, p_user_agent
  )
  on conflict (registration_id, waiver_version) do nothing;

  return jsonb_build_object('ok', true, 'waiver_version', t.waiver_version);
end; $$;
revoke all on function public.sign_tournament_waiver(uuid, text, text) from public, anon;
grant execute on function public.sign_tournament_waiver(uuid, text, text) to authenticated;


-- ── 9. Storage bucket: tournament-media (public read) ────────────────
-- Path convention: {tournament_id}/cover.{ext}. Managers write.

insert into storage.buckets (id, name, public)
values ('tournament-media', 'tournament-media', true)
on conflict (id) do nothing;

drop policy if exists tournament_media_insert on storage.objects;
create policy tournament_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tournament-media'
    and public.can_manage_tournament(nullif(split_part(name, '/', 1), '')::uuid, auth.uid())
  );

drop policy if exists tournament_media_update on storage.objects;
create policy tournament_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'tournament-media'
         and public.can_manage_tournament(nullif(split_part(name, '/', 1), '')::uuid, auth.uid()))
  with check (bucket_id = 'tournament-media'
         and public.can_manage_tournament(nullif(split_part(name, '/', 1), '')::uuid, auth.uid()));

drop policy if exists tournament_media_delete on storage.objects;
create policy tournament_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'tournament-media'
         and public.can_manage_tournament(nullif(split_part(name, '/', 1), '')::uuid, auth.uid()));

commit;

-- DONE.
