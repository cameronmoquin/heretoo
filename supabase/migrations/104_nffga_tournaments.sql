-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 104: Tournaments, registration, waivers, scoring
-- ════════════════════════════════════════════════════════════════════════
-- A TOURNAMENT is one event at one course on one day (or a range). It
-- carries every logistical fact a player needs before they show up and
-- every fact an organizer needs to run the day: where, when, format,
-- fee, what the fee buys, capacity, check-in, start type, cart and
-- dress rules, the rain plan, and who to call.
--
-- PEOPLE. Any NFFGA OFFICER (migration 102, public.is_nffga_officer)
-- may create a tournament and becomes its organizer. The organizer,
-- organizer-role STAFF, and any officer may manage it. Organizers may
-- add staff (co-organizers, scorers, volunteers).
--
-- PUBLIC. Once a tournament leaves draft, anyone — including the signed-
-- out `anon` role — reads the tournament row, the roster view and the
-- leaderboard view. The registration table itself (medical notes,
-- emergency contacts, phone, email, payment) never resolves for anon or
-- for other players: the player sees their own row, managers see all.
--
-- REGISTRATION goes through one RPC that, in a single transaction,
-- checks the window and capacity, seats the player (or waitlists
-- them), records their logistics and captures the WAIVER signature. A
-- player cannot end up registered without a signed waiver when one is
-- required, because there is no other insert path.
--
-- THE WAIVER is evidence. The signature row stores the exact text
-- version signed, a SHA-256 of that text (pgcrypto, schema extensions),
-- the name the player typed, the moment, and what the client reported
-- about itself. The table is append-only: a trigger refuses UPDATE,
-- DELETE and TRUNCATE for every role, including the service role. The
-- waiver TEXT itself is the organizer's and must be reviewed by counsel
-- before a real event uses it.
--
-- SCORING is hole-by-hole rows keyed to a registration (individual
-- formats) or a team (scramble, best ball). Organizers and scorers
-- write. Leaderboards are a view, not a table.
--
-- NO MONEY MOVES HERE either. The entry fee is recorded and marked paid
-- by the organizer; collection is the organizer's business.
--
-- SHARED DATABASE. Project avepftawrkwytlohobjh (EMSPCR) also serves
-- EMSPCR and Car56. Everything here is prefixed nffga_ / nffga-, refers
-- to auth.users directly, and `create or replace`s only functions named
-- nffga_*. Depends on: 102 (is_nffga_officer), 103 (nffga_is_guest,
-- nffga_touch_updated_at), pgcrypto in schema extensions.
--
-- Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Preconditions ─────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.is_nffga_officer(uuid)') is null then
    raise exception 'public.is_nffga_officer(uuid) missing: migration 102 has not run here.';
  end if;
  if to_regprocedure('public.nffga_is_guest()') is null
     or to_regprocedure('public.nffga_touch_updated_at()') is null then
    raise exception 'nffga_is_guest / nffga_touch_updated_at missing: migration 103 has not run here.';
  end if;
  if to_regprocedure('extensions.digest(bytea, text)') is null then
    raise exception 'extensions.digest(bytea, text) missing: pgcrypto is not installed in schema extensions.';
  end if;
end$$;


-- ── 1. Tournaments ───────────────────────────────────────────────────

create table if not exists public.nffga_tournaments (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid not null references auth.users(id) on delete restrict,
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
  cover_path            text,                 -- bucket nffga-media
  public_notes          text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint nffga_tournaments_waiver_text check (not waiver_required or status = 'draft' or waiver_text is not null),
  constraint nffga_tournaments_dates check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

drop trigger if exists nffga_tournaments_updated_at on public.nffga_tournaments;
create trigger nffga_tournaments_updated_at before update on public.nffga_tournaments
  for each row execute function public.nffga_touch_updated_at();

create index if not exists nffga_tournaments_organizer_idx on public.nffga_tournaments(organizer_id);
create index if not exists nffga_tournaments_upcoming_idx  on public.nffga_tournaments(starts_at)
  where status in ('registration_open', 'registration_closed', 'in_progress');


-- ── 2. Staff ─────────────────────────────────────────────────────────

create table if not exists public.nffga_tournament_staff (
  tournament_id uuid not null references public.nffga_tournaments(id) on delete cascade,
  profile_id    uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'organizer' check (role in ('organizer', 'scorer', 'volunteer')),
  added_by      uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, profile_id)
);
create index if not exists nffga_tournament_staff_profile_idx on public.nffga_tournament_staff(profile_id);

-- The creator is staff from the first moment.
create or replace function public.nffga_tournaments_add_organizer_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.nffga_tournament_staff (tournament_id, profile_id, role, added_by)
  values (new.id, new.organizer_id, 'organizer', new.organizer_id)
  on conflict do nothing;
  return new;
end; $$;
revoke all on function public.nffga_tournaments_add_organizer_staff() from public, anon, authenticated;
drop trigger if exists nffga_tournaments_add_organizer_staff_trg on public.nffga_tournaments;
create trigger nffga_tournaments_add_organizer_staff_trg
  after insert on public.nffga_tournaments
  for each row execute function public.nffga_tournaments_add_organizer_staff();

-- Who may run this tournament: the organizer, an organizer-role staff
-- member, or any NFFGA officer.
create or replace function public.nffga_can_manage_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile_id is not null and exists (
    select 1 from public.nffga_tournaments t
    where t.id = p_tournament_id
      and (t.organizer_id = p_profile_id
           or public.is_nffga_officer(p_profile_id)
           or exists (select 1 from public.nffga_tournament_staff s
                      where s.tournament_id = t.id and s.profile_id = p_profile_id and s.role = 'organizer'))
  );
$$;
revoke all on function public.nffga_can_manage_tournament(uuid, uuid) from public, anon;
grant execute on function public.nffga_can_manage_tournament(uuid, uuid) to authenticated;

-- Who may enter scores: managers plus scorer-role staff.
create or replace function public.nffga_can_score_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.nffga_can_manage_tournament(p_tournament_id, p_profile_id)
      or exists (select 1 from public.nffga_tournament_staff s
                 where s.tournament_id = p_tournament_id and s.profile_id = p_profile_id and s.role = 'scorer');
$$;
revoke all on function public.nffga_can_score_tournament(uuid, uuid) from public, anon;
grant execute on function public.nffga_can_score_tournament(uuid, uuid) to authenticated;

-- Who may see it: everyone once out of draft; managers at any status.
-- Anon-callable on purpose: the public roster and leaderboard views call
-- it for signed-out visitors (p_profile_id is then null).
create or replace function public.nffga_can_view_tournament(p_tournament_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nffga_tournaments t
    where t.id = p_tournament_id
      and (t.status <> 'draft'
           or public.nffga_can_manage_tournament(t.id, p_profile_id))
  );
$$;
revoke all on function public.nffga_can_view_tournament(uuid, uuid) from public;
grant execute on function public.nffga_can_view_tournament(uuid, uuid) to anon, authenticated;


-- ── 3. Teams and registrations ───────────────────────────────────────

create table if not exists public.nffga_tournament_teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.nffga_tournaments(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  captain_id      uuid references auth.users(id) on delete set null,
  department_name text,
  created_at      timestamptz not null default now(),
  constraint nffga_tournament_teams_tournament_name_key unique (tournament_id, name)
);
create index if not exists nffga_tournament_teams_tournament_idx on public.nffga_tournament_teams(tournament_id);

create table if not exists public.nffga_tournament_registrations (
  id                      uuid primary key default gen_random_uuid(),
  tournament_id           uuid not null references public.nffga_tournaments(id) on delete cascade,
  player_id               uuid not null references auth.users(id) on delete cascade,
  team_id                 uuid references public.nffga_tournament_teams(id) on delete set null,
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
  constraint nffga_tournament_registrations_tournament_player_key unique (tournament_id, player_id)
);
create index if not exists nffga_tournament_registrations_tournament_idx on public.nffga_tournament_registrations(tournament_id, status);
create index if not exists nffga_tournament_registrations_player_idx     on public.nffga_tournament_registrations(player_id);
create index if not exists nffga_tournament_registrations_team_idx       on public.nffga_tournament_registrations(team_id) where team_id is not null;

-- A team belongs to the same tournament as its players.
create or replace function public.nffga_tournament_registrations_team_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.team_id is not null and not exists (
    select 1 from public.nffga_tournament_teams tt where tt.id = new.team_id and tt.tournament_id = new.tournament_id
  ) then
    raise exception 'team % is not in tournament %', new.team_id, new.tournament_id;
  end if;
  return new;
end; $$;
revoke all on function public.nffga_tournament_registrations_team_guard() from public, anon, authenticated;
drop trigger if exists nffga_tournament_registrations_team_guard_trg on public.nffga_tournament_registrations;
create trigger nffga_tournament_registrations_team_guard_trg
  before insert or update of team_id on public.nffga_tournament_registrations
  for each row execute function public.nffga_tournament_registrations_team_guard();

-- The columns a player may not touch on their own row. Applies to direct
-- client writes only (current_user = 'authenticated'). This function is
-- deliberately SECURITY INVOKER: inside the SECURITY DEFINER RPCs below
-- (withdraw, re-register) current_user is the owner, and those RPCs are
-- the sanctioned path for status changes.
create or replace function public.nffga_tournament_registrations_player_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated'
     and auth.uid() = old.player_id
     and not public.nffga_can_manage_tournament(old.tournament_id, auth.uid()) then
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
revoke all on function public.nffga_tournament_registrations_player_guard() from public, anon, authenticated;
drop trigger if exists nffga_tournament_registrations_player_guard_trg on public.nffga_tournament_registrations;
create trigger nffga_tournament_registrations_player_guard_trg
  before update on public.nffga_tournament_registrations
  for each row execute function public.nffga_tournament_registrations_player_guard();


-- ── 4. Waiver signatures — append-only evidence ──────────────────────

create table if not exists public.nffga_tournament_waiver_signatures (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.nffga_tournaments(id) on delete restrict,
  registration_id uuid not null references public.nffga_tournament_registrations(id) on delete restrict,
  player_id       uuid not null references auth.users(id) on delete restrict,
  waiver_version  integer not null,
  waiver_text     text not null,           -- the exact words, frozen
  waiver_sha256   text not null,           -- hex digest of waiver_text
  signed_name     text not null check (char_length(signed_name) between 2 and 120),
  agreed          boolean not null check (agreed),
  signed_at       timestamptz not null default now(),
  user_agent      text,
  client_ip       inet,
  constraint nffga_tournament_waiver_signatures_reg_version_key unique (registration_id, waiver_version)
);
create index if not exists nffga_tournament_waiver_signatures_tournament_idx on public.nffga_tournament_waiver_signatures(tournament_id);
create index if not exists nffga_tournament_waiver_signatures_player_idx     on public.nffga_tournament_waiver_signatures(player_id);

-- Nobody edits a signature. Not the player, not the organizer, not the
-- service role. A wrong signature is superseded by a new row at a new
-- version, never corrected in place.
create or replace function public.nffga_refuse_signature_change()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'nffga_tournament_waiver_signatures is append-only (% refused)', tg_op;
end; $$;
revoke all on function public.nffga_refuse_signature_change() from public, anon, authenticated;
drop trigger if exists nffga_tournament_waiver_signatures_immutable on public.nffga_tournament_waiver_signatures;
create trigger nffga_tournament_waiver_signatures_immutable
  before update or delete on public.nffga_tournament_waiver_signatures
  for each row execute function public.nffga_refuse_signature_change();
drop trigger if exists nffga_tournament_waiver_signatures_no_truncate on public.nffga_tournament_waiver_signatures;
create trigger nffga_tournament_waiver_signatures_no_truncate
  before truncate on public.nffga_tournament_waiver_signatures
  for each statement execute function public.nffga_refuse_signature_change();

-- Changing waiver_text after signatures exist must bump the version, or
-- old signatures would appear to cover new words.
create or replace function public.nffga_tournaments_waiver_version_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.waiver_text is distinct from old.waiver_text
     and new.waiver_version = old.waiver_version
     and exists (select 1 from public.nffga_tournament_waiver_signatures s
                 where s.tournament_id = old.id and s.waiver_version = old.waiver_version) then
    new.waiver_version := old.waiver_version + 1;
  end if;
  return new;
end; $$;
revoke all on function public.nffga_tournaments_waiver_version_guard() from public, anon, authenticated;
drop trigger if exists nffga_tournaments_waiver_version_guard_trg on public.nffga_tournaments;
create trigger nffga_tournaments_waiver_version_guard_trg
  before update of waiver_text on public.nffga_tournaments
  for each row execute function public.nffga_tournaments_waiver_version_guard();


-- ── 5. Tee sheet and scores ──────────────────────────────────────────

create table if not exists public.nffga_tournament_tee_times (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.nffga_tournaments(id) on delete cascade,
  team_id         uuid references public.nffga_tournament_teams(id) on delete cascade,
  registration_id uuid references public.nffga_tournament_registrations(id) on delete cascade,
  starting_hole   smallint not null default 1 check (starting_hole between 1 and 18),
  position        text,                    -- "A" / "B" when two groups share a hole on a shotgun
  tee_at          timestamptz,             -- for tee-time starts
  group_number    smallint,
  notes           text,
  constraint nffga_tournament_tee_times_one_subject check (
    (team_id is not null)::int + (registration_id is not null)::int = 1
  )
);
create index if not exists nffga_tournament_tee_times_tournament_idx on public.nffga_tournament_tee_times(tournament_id);

create table if not exists public.nffga_tournament_scores (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.nffga_tournaments(id) on delete cascade,
  team_id         uuid references public.nffga_tournament_teams(id) on delete cascade,
  registration_id uuid references public.nffga_tournament_registrations(id) on delete cascade,
  hole            smallint not null check (hole between 1 and 36),
  strokes         smallint not null check (strokes between 1 and 20),
  entered_by      uuid references auth.users(id) on delete set null,
  entered_at      timestamptz not null default now(),
  constraint nffga_tournament_scores_one_subject check (
    (team_id is not null)::int + (registration_id is not null)::int = 1
  )
);
create unique index if not exists nffga_tournament_scores_team_hole_idx
  on public.nffga_tournament_scores(tournament_id, team_id, hole) where team_id is not null;
create unique index if not exists nffga_tournament_scores_player_hole_idx
  on public.nffga_tournament_scores(tournament_id, registration_id, hole) where registration_id is not null;


-- ── 6. RLS ───────────────────────────────────────────────────────────

alter table public.nffga_tournaments                  enable row level security;
alter table public.nffga_tournament_staff             enable row level security;
alter table public.nffga_tournament_teams             enable row level security;
alter table public.nffga_tournament_registrations     enable row level security;
alter table public.nffga_tournament_waiver_signatures enable row level security;
alter table public.nffga_tournament_tee_times         enable row level security;
alter table public.nffga_tournament_scores            enable row level security;

-- Table privileges. Supabase's default privileges grant anon everything
-- on new tables; signed-out visitors get SELECT on tournaments and
-- nothing else (they read the roster and leaderboard through the views).
revoke all on public.nffga_tournaments                  from anon;
revoke all on public.nffga_tournament_staff             from anon;
revoke all on public.nffga_tournament_teams             from anon;
revoke all on public.nffga_tournament_registrations     from anon;
revoke all on public.nffga_tournament_waiver_signatures from anon;
revoke all on public.nffga_tournament_tee_times         from anon;
revoke all on public.nffga_tournament_scores            from anon;
grant select on public.nffga_tournaments to anon, authenticated;
-- Signatures are written only by the SECURITY DEFINER RPCs below.
revoke insert, update, delete, truncate on public.nffga_tournament_waiver_signatures from authenticated;
-- Registrations are inserted only by nffga_register_for_tournament().
revoke insert, truncate on public.nffga_tournament_registrations from authenticated;

-- Tournaments, public face: anyone reads a tournament once it is out of draft.
drop policy if exists nffga_tournaments_public_read on public.nffga_tournaments;
create policy nffga_tournaments_public_read on public.nffga_tournaments
  for select to anon, authenticated
  using (status <> 'draft');

-- Tournaments, managers: every status, drafts included.
drop policy if exists nffga_tournaments_manager_read on public.nffga_tournaments;
create policy nffga_tournaments_manager_read on public.nffga_tournaments
  for select to authenticated
  using (public.nffga_can_manage_tournament(id, auth.uid()));

-- Any NFFGA officer may create one, as its organizer.
drop policy if exists nffga_tournaments_insert on public.nffga_tournaments;
create policy nffga_tournaments_insert on public.nffga_tournaments
  for insert to authenticated
  with check (
    organizer_id = auth.uid()
    and public.is_nffga_officer(auth.uid())
  );

drop policy if exists nffga_tournaments_update on public.nffga_tournaments;
create policy nffga_tournaments_update on public.nffga_tournaments
  for update to authenticated
  using (public.nffga_can_manage_tournament(id, auth.uid()))
  with check (public.nffga_can_manage_tournament(id, auth.uid()));

-- Drafts can be deleted; anything a player may have signed up for is
-- cancelled instead, so registrations and signatures survive.
drop policy if exists nffga_tournaments_delete on public.nffga_tournaments;
create policy nffga_tournaments_delete on public.nffga_tournaments
  for delete to authenticated
  using (status = 'draft' and public.nffga_can_manage_tournament(id, auth.uid()));

drop policy if exists nffga_tournaments_no_guests on public.nffga_tournaments;
create policy nffga_tournaments_no_guests on public.nffga_tournaments
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());

-- Staff: managers read and write; a staffer sees their own row.
drop policy if exists nffga_tournament_staff_read on public.nffga_tournament_staff;
create policy nffga_tournament_staff_read on public.nffga_tournament_staff
  for select to authenticated
  using (profile_id = auth.uid() or public.nffga_can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_staff_write on public.nffga_tournament_staff;
create policy nffga_tournament_staff_write on public.nffga_tournament_staff
  for all to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_manage_tournament(tournament_id, auth.uid()));

-- Teams: signed-in viewers of the tournament see the teams; managers
-- write; a registered player may create a team and captain it.
drop policy if exists nffga_tournament_teams_read on public.nffga_tournament_teams;
create policy nffga_tournament_teams_read on public.nffga_tournament_teams
  for select to authenticated
  using (public.nffga_can_view_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_teams_manage on public.nffga_tournament_teams;
create policy nffga_tournament_teams_manage on public.nffga_tournament_teams
  for all to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_teams_captain_insert on public.nffga_tournament_teams;
create policy nffga_tournament_teams_captain_insert on public.nffga_tournament_teams
  for insert to authenticated
  with check (
    captain_id = auth.uid()
    and exists (select 1 from public.nffga_tournament_registrations r
                where r.tournament_id = nffga_tournament_teams.tournament_id
                  and r.player_id = auth.uid() and r.status in ('registered', 'checked_in'))
  );

drop policy if exists nffga_tournament_teams_captain_update on public.nffga_tournament_teams;
create policy nffga_tournament_teams_captain_update on public.nffga_tournament_teams
  for update to authenticated
  using (captain_id = auth.uid()) with check (captain_id = auth.uid());

-- Registrations. A player sees their own row in full. Managers see every
-- row in full. Everyone else — other players and anon — sees the roster
-- through nffga_tournament_roster below, which carries no medical,
-- contact or payment columns; the table itself never resolves for them.
drop policy if exists nffga_tournament_registrations_read on public.nffga_tournament_registrations;
create policy nffga_tournament_registrations_read on public.nffga_tournament_registrations
  for select to authenticated
  using (player_id = auth.uid() or public.nffga_can_manage_tournament(tournament_id, auth.uid()));

-- No direct insert. nffga_register_for_tournament() is the only way in,
-- so the window, capacity and waiver are never skipped.

-- A player edits their own logistics; status, paid and team are the
-- organizer's, held fixed by the player-guard trigger.
drop policy if exists nffga_tournament_registrations_self_update on public.nffga_tournament_registrations;
create policy nffga_tournament_registrations_self_update on public.nffga_tournament_registrations
  for update to authenticated
  using (player_id = auth.uid())
  with check (player_id = auth.uid());

drop policy if exists nffga_tournament_registrations_manage on public.nffga_tournament_registrations;
create policy nffga_tournament_registrations_manage on public.nffga_tournament_registrations
  for update to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_registrations_manage_delete on public.nffga_tournament_registrations;
create policy nffga_tournament_registrations_manage_delete on public.nffga_tournament_registrations
  for delete to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid())
         and not exists (select 1 from public.nffga_tournament_waiver_signatures s
                         where s.registration_id = nffga_tournament_registrations.id));

-- Waiver signatures: the player reads their own; managers read all.
-- No write policy — the registration and signing RPCs write them.
drop policy if exists nffga_tournament_waiver_signatures_read on public.nffga_tournament_waiver_signatures;
create policy nffga_tournament_waiver_signatures_read on public.nffga_tournament_waiver_signatures
  for select to authenticated
  using (player_id = auth.uid() or public.nffga_can_manage_tournament(tournament_id, auth.uid()));

-- Tee times: signed-in viewers read; managers write.
drop policy if exists nffga_tournament_tee_times_read on public.nffga_tournament_tee_times;
create policy nffga_tournament_tee_times_read on public.nffga_tournament_tee_times
  for select to authenticated
  using (public.nffga_can_view_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_tee_times_write on public.nffga_tournament_tee_times;
create policy nffga_tournament_tee_times_write on public.nffga_tournament_tee_times
  for all to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_manage_tournament(tournament_id, auth.uid()));

-- Scores: signed-in viewers read; scorers and managers write.
drop policy if exists nffga_tournament_scores_read on public.nffga_tournament_scores;
create policy nffga_tournament_scores_read on public.nffga_tournament_scores
  for select to authenticated
  using (public.nffga_can_view_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_scores_write on public.nffga_tournament_scores;
create policy nffga_tournament_scores_write on public.nffga_tournament_scores
  for all to authenticated
  using (public.nffga_can_score_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_score_tournament(tournament_id, auth.uid()) and entered_by = auth.uid());


-- ── 7. Public views: roster and leaderboard ──────────────────────────
-- security_invoker is OFF on purpose: each view is the door through the
-- tables' RLS, exposing only the columns a stranger has any business
-- seeing, and only for tournaments out of draft (or that the caller
-- manages). Readable by anon and authenticated.

create or replace view public.nffga_tournament_roster
  with (security_invoker = false) as
  select r.id, r.tournament_id, r.player_id, r.team_id, r.status,
         r.full_name, r.department_name, r.rank_title, r.handicap,
         r.registered_at, r.checked_in_at,
         tm.name as team_name
  from public.nffga_tournament_registrations r
  left join public.nffga_tournament_teams tm on tm.id = r.team_id
  where r.status in ('registered', 'waitlisted', 'checked_in')
    and public.nffga_can_view_tournament(r.tournament_id, auth.uid());
revoke all on public.nffga_tournament_roster from public, anon, authenticated;
grant select on public.nffga_tournament_roster to anon, authenticated;

-- Totals per team or player. Ties are the app's problem to break.
create or replace view public.nffga_tournament_leaderboard
  with (security_invoker = false) as
  select s.tournament_id, s.team_id, s.registration_id,
         count(*)::int        as holes_scored,
         sum(s.strokes)::int  as total_strokes,
         max(s.entered_at)    as last_entry_at,
         tm.name              as team_name,
         r.full_name          as player_name
  from public.nffga_tournament_scores s
  left join public.nffga_tournament_teams tm on tm.id = s.team_id
  left join public.nffga_tournament_registrations r on r.id = s.registration_id
  where public.nffga_can_view_tournament(s.tournament_id, auth.uid())
  group by s.tournament_id, s.team_id, s.registration_id, tm.name, r.full_name;
revoke all on public.nffga_tournament_leaderboard from public, anon, authenticated;
grant select on public.nffga_tournament_leaderboard to anon, authenticated;


-- ── 8. Registration, in one transaction ──────────────────────────────
-- p_details carries the logistics columns by name (full_name required).
-- p_signed_name is the typed signature; required when the tournament
-- requires a waiver. Returns the registration row's id and status.
create or replace function public.nffga_register_for_tournament(
  p_tournament_id uuid,
  p_details       jsonb,
  p_signed_name   text default null,
  p_user_agent    text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t          public.nffga_tournaments;
  uid        uuid := auth.uid();
  seated     integer;
  new_status text;
  reg_id     uuid;
  fname      text := nullif(btrim(coalesce(p_details->>'full_name', '')), '');
begin
  if uid is null or public.nffga_is_guest() then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if fname is null then
    return jsonb_build_object('ok', false, 'error', 'full_name_required');
  end if;

  select * into t from public.nffga_tournaments where id = p_tournament_id for update;
  if not found or not public.nffga_can_view_tournament(t.id, uid) then
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
  if exists (select 1 from public.nffga_tournament_registrations r
             where r.tournament_id = t.id and r.player_id = uid and r.status <> 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;
  if t.waiver_required and (t.waiver_text is null or nullif(btrim(coalesce(p_signed_name, '')), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'waiver_signature_required');
  end if;

  -- Capacity: seated players count; waitlisted do not.
  select count(*) into seated from public.nffga_tournament_registrations r
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
  insert into public.nffga_tournament_registrations as r (
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
    insert into public.nffga_tournament_waiver_signatures (
      tournament_id, registration_id, player_id, waiver_version, waiver_text,
      waiver_sha256, signed_name, agreed, user_agent
    ) values (
      t.id, reg_id, uid, t.waiver_version, t.waiver_text,
      encode(extensions.digest(convert_to(t.waiver_text, 'UTF8'), 'sha256'), 'hex'),
      btrim(p_signed_name), true, p_user_agent
    )
    on conflict (registration_id, waiver_version) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'registration_id', reg_id, 'status', new_status);
end; $$;
revoke all on function public.nffga_register_for_tournament(uuid, jsonb, text, text) from public, anon;
grant execute on function public.nffga_register_for_tournament(uuid, jsonb, text, text) to authenticated;

-- Withdraw, and promote the first waitlisted player if a seat opened.
create or replace function public.nffga_withdraw_from_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.nffga_tournament_registrations;
  promoted uuid;
begin
  select * into r from public.nffga_tournament_registrations
    where tournament_id = p_tournament_id and player_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_registered'); end if;
  if r.status in ('withdrawn', 'disqualified') then
    return jsonb_build_object('ok', false, 'error', 'already_withdrawn');
  end if;

  update public.nffga_tournament_registrations
    set status = 'withdrawn', withdrawn_at = now(), team_id = null where id = r.id;

  if r.status in ('registered', 'checked_in') then
    update public.nffga_tournament_registrations
      set status = 'registered'
      where id = (select id from public.nffga_tournament_registrations
                  where tournament_id = p_tournament_id and status = 'waitlisted'
                  order by registered_at limit 1)
      returning player_id into promoted;
  end if;

  return jsonb_build_object('ok', true, 'promoted_player_id', promoted);
end; $$;
revoke all on function public.nffga_withdraw_from_tournament(uuid) from public, anon;
grant execute on function public.nffga_withdraw_from_tournament(uuid) to authenticated;

-- Organizer's check-in.
create or replace function public.nffga_check_in_player(p_registration_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.nffga_tournament_registrations;
begin
  select * into r from public.nffga_tournament_registrations where id = p_registration_id for update;
  if not found or not public.nffga_can_manage_tournament(r.tournament_id, auth.uid()) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if r.status not in ('registered', 'waitlisted') then
    return jsonb_build_object('ok', false, 'error', 'not_checkable', 'status', r.status);
  end if;
  update public.nffga_tournament_registrations
    set status = 'checked_in', checked_in_at = now() where id = r.id;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_check_in_player(uuid) from public, anon;
grant execute on function public.nffga_check_in_player(uuid) to authenticated;

-- Sign the CURRENT waiver. A waiver revised after registration needs a
-- new signature; the app asks before the tee sheet.
create or replace function public.nffga_sign_tournament_waiver(
  p_tournament_id uuid,
  p_signed_name   text,
  p_user_agent    text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.nffga_tournaments;
  r public.nffga_tournament_registrations;
begin
  if auth.uid() is null or public.nffga_is_guest() then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  select * into t from public.nffga_tournaments where id = p_tournament_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from public.nffga_tournament_registrations
    where tournament_id = t.id and player_id = auth.uid() and status <> 'withdrawn';
  if not found then return jsonb_build_object('ok', false, 'error', 'not_registered'); end if;
  if t.waiver_text is null then return jsonb_build_object('ok', false, 'error', 'no_waiver'); end if;
  if nullif(btrim(coalesce(p_signed_name, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'signature_required');
  end if;

  insert into public.nffga_tournament_waiver_signatures (
    tournament_id, registration_id, player_id, waiver_version, waiver_text,
    waiver_sha256, signed_name, agreed, user_agent
  ) values (
    t.id, r.id, auth.uid(), t.waiver_version, t.waiver_text,
    encode(extensions.digest(convert_to(t.waiver_text, 'UTF8'), 'sha256'), 'hex'),
    btrim(p_signed_name), true, p_user_agent
  )
  on conflict (registration_id, waiver_version) do nothing;

  return jsonb_build_object('ok', true, 'waiver_version', t.waiver_version);
end; $$;
revoke all on function public.nffga_sign_tournament_waiver(uuid, text, text) from public, anon;
grant execute on function public.nffga_sign_tournament_waiver(uuid, text, text) to authenticated;


-- ── 9. Storage bucket: nffga-media (public read) ─────────────────────
-- Board photos and tournament covers. Path conventions:
--   {user_id}/...          a member's own uploads (board post photos)
--   {tournament_id}/...    tournament covers; that tournament's managers
-- A public bucket serves objects by URL without any SELECT policy.

create or replace function public.nffga_can_write_media_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    case
      when auth.uid() is null then false
      when split_part(p_name, '/', 1) = auth.uid()::text then true
      when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.nffga_can_manage_tournament(split_part(p_name, '/', 1)::uuid, auth.uid())
      else false
    end, false);
$$;
revoke all on function public.nffga_can_write_media_path(text) from public, anon;
grant execute on function public.nffga_can_write_media_path(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('nffga-media', 'nffga-media', true)
on conflict (id) do nothing;

-- The storage API needs SELECT on an object to upsert or remove it.
drop policy if exists nffga_media_objects_select on storage.objects;
create policy nffga_media_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'nffga-media' and public.nffga_can_write_media_path(name));

drop policy if exists nffga_media_objects_insert on storage.objects;
create policy nffga_media_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nffga-media'
    and not public.nffga_is_guest()
    and public.nffga_can_write_media_path(name)
  );

drop policy if exists nffga_media_objects_update on storage.objects;
create policy nffga_media_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'nffga-media' and public.nffga_can_write_media_path(name))
  with check (bucket_id = 'nffga-media' and public.nffga_can_write_media_path(name));

drop policy if exists nffga_media_objects_delete on storage.objects;
create policy nffga_media_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'nffga-media' and public.nffga_can_write_media_path(name));

commit;

-- DONE.
