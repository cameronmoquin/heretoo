-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 107: Events v2 — team entry, packages, contests,
--                        host departments, event requests
-- ════════════════════════════════════════════════════════════════════════
-- Builds on 104 (tournaments). What real charity and association golf
-- outings publish, and what this adds to carry it:
--
-- TOURNAMENT COLUMNS
--   entry_mode       'individual' | 'team' | 'both' (default 'both'). Who
--                    may enter: single golfers, full teams ("foursomes"),
--                    or either.
--   team_fee_cents   Price of a whole team entry (a foursome is usually a
--                    small discount on four singles). Null = not stated.
--   packages         jsonb array of add-ons and sponsorships:
--                    [{ name, price_cents, description, quantity_available }]
--                    (title sponsor, hole sponsor, beverage cart, mulligan
--                    package, ...). Recorded, never sold here.
--   contests         jsonb array of on-course contests:
--                    [{ name, hole, prize, sponsor }]
--                    (closest to the pin, longest drive, hole-in-one, ...).
--   host_department  The fire department hosting a regional event.
--   sanctioned       true (default) = officiated by NFFGA.
--   What the fee includes stays in 104's fee_includes (text).
--
-- NULL ORGANIZER. nffga_tournaments.organizer_id is now NULLABLE. Null
-- means NFFGA itself created the event (the SQL editor, a seed). Every
-- 104 rule still holds with a null organizer: nffga_can_manage_tournament
-- falls through to "any officer" (null = uid is null, never true); the
-- client insert policy still requires organizer_id = auth.uid(), so only
-- the database owner creates organizer-less rows; and the trigger that
-- seats the organizer as staff is replaced below to skip a null
-- organizer instead of failing.
--
-- TEAM ENTRY. A team (typically a foursome) is entered by its CAPTAIN,
-- who has an account. nffga_enter_team() does it in one transaction:
-- window, entry mode and capacity checks; the team row (team_entry =
-- true); the captain's own registration with the captain's waiver
-- signature (the captain signs for THEMSELF only — same evidence row as
-- 104); and the teammates, by name, in nffga_tournament_team_players.
-- TEAMMATES DO NOT NEED ACCOUNTS AND DO NOT SIGN ONLINE. Each teammate
-- signs the waiver on paper at check-in (or later); a manager then ticks
-- waiver_signed on that teammate's row (stamped with who and when).
--
-- CAPACITY. A team entry takes team_size seats, whatever number of
-- teammates is named (the organizer pairs any open slots). An individual
-- takes one. max_teams caps team entries. Waitlisting applies to whole
-- teams. nffga_register_for_tournament and nffga_withdraw_from_tournament
-- (104) are replaced, same signatures, to count seats this way and to
-- promote waitlisted entries only when they fit.
--
-- PRIVACY. The public roster view (104, extended here) now also lists
-- teammates by name with their team name, department and handicap. It
-- never carries an email, phone, shirt size or waiver flag. The
-- teammate table itself is readable only by that team's captain and the
-- tournament's managers; never anon.
--
-- EVENT REQUESTS. A fire department proposes a regional event to be
-- officiated by NFFGA: nffga_event_requests. Signed-in, non-guest users
-- insert their own and read their own; officers read and update all.
-- officer_notes is visible to the submitter (it carries the reason for a
-- decline). nffga_create_tournament_from_request() (officers only)
-- makes a DRAFT tournament prefilled from the request, with the
-- approving officer as organizer, links it, and marks the request
-- approved.
--
-- SHARED DATABASE. Project avepftawrkwytlohobjh (EMSPCR) also serves
-- EMSPCR and Car56. Everything here is prefixed nffga_, refers to
-- auth.users directly, and `create or replace`s only functions named
-- nffga_*. Depends on: 102 (is_nffga_officer), 103 (nffga_is_guest,
-- nffga_touch_updated_at), 104 (tournaments), pgcrypto in schema
-- extensions.
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
  if to_regclass('public.nffga_tournaments') is null
     or to_regclass('public.nffga_tournament_registrations') is null
     or to_regprocedure('public.nffga_can_manage_tournament(uuid, uuid)') is null then
    raise exception 'nffga tournaments missing: migration 104 has not run here.';
  end if;
  if to_regprocedure('extensions.digest(bytea, text)') is null then
    raise exception 'extensions.digest(bytea, text) missing: pgcrypto is not installed in schema extensions.';
  end if;
end$$;


-- ── 1. Tournament columns ────────────────────────────────────────────

alter table public.nffga_tournaments
  add column if not exists entry_mode      text    not null default 'both',
  add column if not exists team_fee_cents  integer,
  add column if not exists packages        jsonb   not null default '[]'::jsonb,
  add column if not exists contests        jsonb   not null default '[]'::jsonb,
  add column if not exists host_department text,
  add column if not exists sanctioned      boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nffga_tournaments_entry_mode_check') then
    alter table public.nffga_tournaments add constraint nffga_tournaments_entry_mode_check
      check (entry_mode in ('individual', 'team', 'both'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nffga_tournaments_team_fee_check') then
    alter table public.nffga_tournaments add constraint nffga_tournaments_team_fee_check
      check (team_fee_cents is null or team_fee_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nffga_tournaments_packages_array') then
    alter table public.nffga_tournaments add constraint nffga_tournaments_packages_array
      check (jsonb_typeof(packages) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nffga_tournaments_contests_array') then
    alter table public.nffga_tournaments add constraint nffga_tournaments_contests_array
      check (jsonb_typeof(contests) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nffga_tournaments_host_department_len') then
    alter table public.nffga_tournaments add constraint nffga_tournaments_host_department_len
      check (host_department is null or char_length(host_department) <= 140);
  end if;
end$$;

-- Null organizer = created by NFFGA itself.
alter table public.nffga_tournaments alter column organizer_id drop not null;

-- 104's trigger seated the organizer as staff and would fail on null.
create or replace function public.nffga_tournaments_add_organizer_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organizer_id is not null then
    insert into public.nffga_tournament_staff (tournament_id, profile_id, role, added_by)
    values (new.id, new.organizer_id, 'organizer', new.organizer_id)
    on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.nffga_tournaments_add_organizer_staff() from public, anon, authenticated;


-- ── 2. Teams entered as teams, and their named players ───────────────

alter table public.nffga_tournament_teams
  add column if not exists team_entry boolean not null default false;   -- true = entered by nffga_enter_team, holds team_size seats

create table if not exists public.nffga_tournament_team_players (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references public.nffga_tournaments(id) on delete cascade,
  team_id          uuid not null references public.nffga_tournament_teams(id) on delete cascade,
  position         smallint not null check (position between 2 and 6),   -- the captain is 1
  full_name        text not null check (char_length(full_name) between 1 and 120),
  email            text check (email is null or char_length(email) <= 254),
  handicap         numeric(4,1) check (handicap is null or handicap between -10 and 54),
  department_name  text check (department_name is null or char_length(department_name) <= 140),
  shirt_size       text check (shirt_size is null or shirt_size in ('XS','S','M','L','XL','XXL','XXXL')),
  waiver_signed    boolean not null default false,   -- ticked by a manager when the paper waiver is signed
  waiver_signed_at timestamptz,
  waiver_marked_by uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint nffga_tournament_team_players_team_position_key unique (team_id, position)
);
create index if not exists nffga_tournament_team_players_tournament_idx on public.nffga_tournament_team_players(tournament_id);
create index if not exists nffga_tournament_team_players_team_idx       on public.nffga_tournament_team_players(team_id);

-- Same tournament as the team; stamp who ticked the waiver and when.
create or replace function public.nffga_tournament_team_players_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.nffga_tournament_teams tm
                 where tm.id = new.team_id and tm.tournament_id = new.tournament_id) then
    raise exception 'team % is not in tournament %', new.team_id, new.tournament_id;
  end if;
  if tg_op = 'INSERT' then
    if new.waiver_signed then
      new.waiver_signed_at := coalesce(new.waiver_signed_at, now());
      new.waiver_marked_by := coalesce(new.waiver_marked_by, auth.uid());
    end if;
  elsif new.waiver_signed is distinct from old.waiver_signed then
    if new.waiver_signed then
      new.waiver_signed_at := now();
      new.waiver_marked_by := auth.uid();
    else
      new.waiver_signed_at := null;
      new.waiver_marked_by := null;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.nffga_tournament_team_players_guard() from public, anon, authenticated;
drop trigger if exists nffga_tournament_team_players_guard_trg on public.nffga_tournament_team_players;
create trigger nffga_tournament_team_players_guard_trg
  before insert or update on public.nffga_tournament_team_players
  for each row execute function public.nffga_tournament_team_players_guard();

alter table public.nffga_tournament_team_players enable row level security;
revoke all on public.nffga_tournament_team_players from anon;
-- Written by nffga_enter_team(); managers correct and tick waivers.
revoke insert, truncate on public.nffga_tournament_team_players from authenticated;

drop policy if exists nffga_tournament_team_players_read on public.nffga_tournament_team_players;
create policy nffga_tournament_team_players_read on public.nffga_tournament_team_players
  for select to authenticated
  using (
    public.nffga_can_manage_tournament(tournament_id, auth.uid())
    or exists (select 1 from public.nffga_tournament_teams tm
               where tm.id = team_id and tm.captain_id = auth.uid())
  );

drop policy if exists nffga_tournament_team_players_manage on public.nffga_tournament_team_players;
create policy nffga_tournament_team_players_manage on public.nffga_tournament_team_players
  for update to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()))
  with check (public.nffga_can_manage_tournament(tournament_id, auth.uid()));

drop policy if exists nffga_tournament_team_players_manage_delete on public.nffga_tournament_team_players;
create policy nffga_tournament_team_players_manage_delete on public.nffga_tournament_team_players
  for delete to authenticated
  using (public.nffga_can_manage_tournament(tournament_id, auth.uid()));


-- ── 3. Seats ─────────────────────────────────────────────────────────
-- Seated = registered or checked in. A seated captain of a team entry
-- holds team_size seats; everyone else holds one.

create or replace function public.nffga_tournament_seats_taken(p_tournament_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when tm.team_entry and tm.captain_id = r.player_id then t.team_size else 1 end), 0)::int
  from public.nffga_tournaments t
  join public.nffga_tournament_registrations r on r.tournament_id = t.id
  left join public.nffga_tournament_teams tm on tm.id = r.team_id
  where t.id = p_tournament_id and r.status in ('registered', 'checked_in');
$$;
revoke all on function public.nffga_tournament_seats_taken(uuid) from public, anon, authenticated;

create or replace function public.nffga_tournament_teams_entered(p_tournament_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.nffga_tournament_registrations r
  join public.nffga_tournament_teams tm on tm.id = r.team_id
  where r.tournament_id = p_tournament_id and r.status in ('registered', 'checked_in')
    and tm.team_entry and tm.captain_id = r.player_id;
$$;
revoke all on function public.nffga_tournament_teams_entered(uuid) from public, anon, authenticated;


-- ── 4. Public views ──────────────────────────────────────────────────
-- Roster: 104's columns unchanged and in order; two columns appended;
-- teammates added as rows. Contact data never appears.

create or replace view public.nffga_tournament_roster
  with (security_invoker = false) as
  select r.id, r.tournament_id, r.player_id, r.team_id, r.status,
         r.full_name, r.department_name, r.rank_title, r.handicap,
         r.registered_at, r.checked_in_at,
         tm.name as team_name,
         'player'::text as entry_kind,
         coalesce(tm.captain_id = r.player_id, false) as is_captain
  from public.nffga_tournament_registrations r
  left join public.nffga_tournament_teams tm on tm.id = r.team_id
  where r.status in ('registered', 'waitlisted', 'checked_in')
    and public.nffga_can_view_tournament(r.tournament_id, auth.uid())
  union all
  select tp.id, tp.tournament_id, null::uuid, tp.team_id, cr.status,
         tp.full_name, tp.department_name, null::text, tp.handicap,
         tp.created_at, null::timestamptz,
         tm.name,
         'teammate'::text,
         false
  from public.nffga_tournament_team_players tp
  join public.nffga_tournament_teams tm on tm.id = tp.team_id
  join public.nffga_tournament_registrations cr
    on cr.team_id = tm.id and cr.player_id = tm.captain_id and cr.tournament_id = tm.tournament_id
  where cr.status in ('registered', 'waitlisted', 'checked_in')
    and public.nffga_can_view_tournament(tp.tournament_id, auth.uid());
revoke all on public.nffga_tournament_roster from public, anon, authenticated;
grant select on public.nffga_tournament_roster to anon, authenticated;

-- Field counts per tournament, for "N of M spots" without reading rows.
create or replace view public.nffga_tournament_field_counts
  with (security_invoker = false) as
  select t.id as tournament_id,
         coalesce(sum(case when r.status in ('registered', 'checked_in')
                           then case when tm.team_entry and tm.captain_id = r.player_id then t.team_size else 1 end
                      end), 0)::int as seats_taken,
         (count(*) filter (where r.status in ('registered', 'checked_in')
                             and tm.team_entry and tm.captain_id = r.player_id))::int as teams_entered,
         (count(*) filter (where r.status = 'waitlisted'))::int as waitlisted
  from public.nffga_tournaments t
  left join public.nffga_tournament_registrations r on r.tournament_id = t.id
  left join public.nffga_tournament_teams tm on tm.id = r.team_id
  where public.nffga_can_view_tournament(t.id, auth.uid())
  group by t.id, t.team_size;
revoke all on public.nffga_tournament_field_counts from public, anon, authenticated;
grant select on public.nffga_tournament_field_counts to anon, authenticated;


-- ── 5. Individual registration (104, replaced: entry mode, seats) ────

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
  if t.entry_mode = 'team' then
    return jsonb_build_object('ok', false, 'error', 'teams_only');
  end if;
  if exists (select 1 from public.nffga_tournament_registrations r
             where r.tournament_id = t.id and r.player_id = uid and r.status <> 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;
  if t.waiver_required and (t.waiver_text is null or nullif(btrim(coalesce(p_signed_name, '')), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'waiver_signature_required');
  end if;

  -- Capacity: seats held by seated entries; waitlisted hold none.
  seated := public.nffga_tournament_seats_taken(t.id);
  if t.max_players is not null and seated + 1 > t.max_players then
    if not t.waitlist_enabled then
      return jsonb_build_object('ok', false, 'error', 'full');
    end if;
    new_status := 'waitlisted';
  else
    new_status := 'registered';
  end if;

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


-- ── 6. Team entry ────────────────────────────────────────────────────
-- p_players: [{ full_name, email?, handicap?, department_name?, shirt_size? }]
-- for the teammates (not the captain), at most team_size - 1 of them.
-- p_captain_details: the same keys as nffga_register_for_tournament's
-- p_details. p_signed_name: the captain's own signature.

create or replace function public.nffga_enter_team(
  p_tournament_id   uuid,
  p_team_name       text,
  p_players         jsonb,
  p_captain_details jsonb,
  p_signed_name     text default null,
  p_user_agent      text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t          public.nffga_tournaments;
  uid        uuid := auth.uid();
  tname      text := nullif(btrim(coalesce(p_team_name, '')), '');
  cap        jsonb := coalesce(p_captain_details, '{}'::jsonb);
  players    jsonb := coalesce(p_players, '[]'::jsonb);
  fname      text;
  p          jsonb;
  pos        smallint;
  hcp        text;
  em         text;
  sz         text;
  old_team   public.nffga_tournament_teams;
  seated     integer;
  teams_in   integer;
  new_status text;
  team_id_v  uuid;
  reg_id     uuid;
begin
  if uid is null or public.nffga_is_guest() then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if tname is null or char_length(tname) > 80 then
    return jsonb_build_object('ok', false, 'error', 'team_name_required');
  end if;
  fname := nullif(btrim(coalesce(cap->>'full_name', '')), '');
  if fname is null then
    return jsonb_build_object('ok', false, 'error', 'full_name_required');
  end if;
  if jsonb_typeof(players) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'bad_players');
  end if;
  hcp := nullif(btrim(coalesce(cap->>'handicap', '')), '');
  if hcp is not null and not (case when hcp ~ '^-?\d{1,2}(\.\d)?$' then hcp::numeric between -10 and 54 else false end) then
    return jsonb_build_object('ok', false, 'error', 'bad_handicap');
  end if;
  sz := nullif(btrim(coalesce(cap->>'years_of_service', '')), '');
  if sz is not null and not (case when sz ~ '^\d{1,2}$' then sz::int <= 70 else false end) then
    return jsonb_build_object('ok', false, 'error', 'bad_years');
  end if;
  if nullif(cap->>'shirt_size', '') is not null and cap->>'shirt_size' not in ('XS','S','M','L','XL','XXL','XXXL') then
    return jsonb_build_object('ok', false, 'error', 'bad_shirt_size');
  end if;

  -- Each teammate: a name, and valid optional fields.
  for p in select value from jsonb_array_elements(players) loop
    if jsonb_typeof(p) <> 'object' or nullif(btrim(coalesce(p->>'full_name', '')), '') is null then
      return jsonb_build_object('ok', false, 'error', 'teammate_name_required');
    end if;
    if char_length(btrim(p->>'full_name')) > 120 then
      return jsonb_build_object('ok', false, 'error', 'teammate_name_too_long');
    end if;
    hcp := nullif(btrim(coalesce(p->>'handicap', '')), '');
    if hcp is not null and not (case when hcp ~ '^-?\d{1,2}(\.\d)?$' then hcp::numeric between -10 and 54 else false end) then
      return jsonb_build_object('ok', false, 'error', 'bad_handicap');
    end if;
    em := nullif(btrim(coalesce(p->>'email', '')), '');
    if em is not null and (em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(em) > 254) then
      return jsonb_build_object('ok', false, 'error', 'bad_email');
    end if;
    sz := nullif(upper(btrim(coalesce(p->>'shirt_size', ''))), '');
    if sz is not null and sz not in ('XS','S','M','L','XL','XXL','XXXL') then
      return jsonb_build_object('ok', false, 'error', 'bad_shirt_size');
    end if;
  end loop;

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
  if t.entry_mode = 'individual' or t.team_size < 2 then
    return jsonb_build_object('ok', false, 'error', 'individuals_only');
  end if;
  if jsonb_array_length(players) > t.team_size - 1 then
    return jsonb_build_object('ok', false, 'error', 'too_many_players', 'max_teammates', t.team_size - 1);
  end if;
  if exists (select 1 from public.nffga_tournament_registrations r
             where r.tournament_id = t.id and r.player_id = uid and r.status <> 'withdrawn') then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;
  if t.waiver_required and (t.waiver_text is null or nullif(btrim(coalesce(p_signed_name, '')), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'waiver_signature_required');
  end if;

  -- A team name is taken while any active registration points at it. The
  -- caller's own abandoned team (they withdrew) is cleared so they can
  -- enter again under the same name.
  select * into old_team from public.nffga_tournament_teams tm
    where tm.tournament_id = t.id and lower(tm.name) = lower(tname)
    limit 1;
  if found then
    if old_team.captain_id = uid
       and not exists (select 1 from public.nffga_tournament_registrations r
                       where r.team_id = old_team.id and r.status <> 'withdrawn') then
      delete from public.nffga_tournament_teams where id = old_team.id;
    else
      return jsonb_build_object('ok', false, 'error', 'team_name_taken');
    end if;
  end if;

  -- Capacity: the team holds team_size seats, all or nothing.
  seated   := public.nffga_tournament_seats_taken(t.id);
  teams_in := public.nffga_tournament_teams_entered(t.id);
  if (t.max_players is not null and seated + t.team_size > t.max_players)
     or (t.max_teams is not null and teams_in >= t.max_teams) then
    if not t.waitlist_enabled then
      return jsonb_build_object('ok', false, 'error', 'full');
    end if;
    new_status := 'waitlisted';
  else
    new_status := 'registered';
  end if;

  insert into public.nffga_tournament_teams (tournament_id, name, captain_id, department_name, team_entry)
  values (t.id, tname, uid, nullif(btrim(coalesce(cap->>'department_name', '')), ''), true)
  returning id into team_id_v;

  insert into public.nffga_tournament_registrations as r (
    tournament_id, player_id, team_id, status, full_name, department_name, rank_title,
    years_of_service, phone, email, handicap, ghin_number, preferred_partners,
    shirt_size, dietary_notes, cart_request, needs_rental_clubs, accessibility_notes,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    medical_notes, notes
  ) values (
    t.id, uid, team_id_v, new_status, fname,
    cap->>'department_name', cap->>'rank_title',
    nullif(btrim(coalesce(cap->>'years_of_service', '')), '')::smallint,
    cap->>'phone', cap->>'email',
    nullif(btrim(coalesce(cap->>'handicap', '')), '')::numeric, cap->>'ghin_number', cap->>'preferred_partners',
    nullif(cap->>'shirt_size', ''), cap->>'dietary_notes',
    coalesce((cap->>'cart_request')::boolean, true),
    coalesce((cap->>'needs_rental_clubs')::boolean, false),
    cap->>'accessibility_notes',
    cap->>'emergency_contact_name', cap->>'emergency_contact_phone',
    cap->>'emergency_contact_relation',
    cap->>'medical_notes', cap->>'notes'
  )
  on conflict (tournament_id, player_id) do update set
    team_id = excluded.team_id,
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
    registered_at = now(), withdrawn_at = null, checked_in_at = null
  returning r.id into reg_id;

  pos := 1;
  for p in select value from jsonb_array_elements(players) loop
    pos := pos + 1;
    insert into public.nffga_tournament_team_players (
      tournament_id, team_id, position, full_name, email, handicap, department_name, shirt_size
    ) values (
      t.id, team_id_v, pos, btrim(p->>'full_name'),
      nullif(btrim(coalesce(p->>'email', '')), ''),
      nullif(btrim(coalesce(p->>'handicap', '')), '')::numeric,
      nullif(btrim(coalesce(p->>'department_name', '')), ''),
      nullif(upper(btrim(coalesce(p->>'shirt_size', ''))), '')
    );
  end loop;

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

  return jsonb_build_object('ok', true, 'team_id', team_id_v, 'registration_id', reg_id, 'status', new_status);
end; $$;
revoke all on function public.nffga_enter_team(uuid, text, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.nffga_enter_team(uuid, text, jsonb, jsonb, text, text) to authenticated;


-- ── 7. Withdraw (104, replaced: promote waitlisted entries that fit) ─
-- A captain's withdrawal withdraws the whole team: the team's seats are
-- released and it drops off the public roster.

create or replace function public.nffga_withdraw_from_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t        public.nffga_tournaments;
  r        public.nffga_tournament_registrations;
  w        record;
  promoted uuid;
  seated   integer;
  teams_in integer;
begin
  select * into t from public.nffga_tournaments where id = p_tournament_id for update;
  select * into r from public.nffga_tournament_registrations
    where tournament_id = p_tournament_id and player_id = auth.uid() for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_registered'); end if;
  if r.status in ('withdrawn', 'disqualified') then
    return jsonb_build_object('ok', false, 'error', 'already_withdrawn');
  end if;

  update public.nffga_tournament_registrations
    set status = 'withdrawn', withdrawn_at = now(), team_id = null where id = r.id;

  if r.status in ('registered', 'checked_in') then
    for w in
      select x.id, x.player_id,
             (tm.team_entry is true and tm.captain_id = x.player_id) as is_team
      from public.nffga_tournament_registrations x
      left join public.nffga_tournament_teams tm on tm.id = x.team_id
      where x.tournament_id = p_tournament_id and x.status = 'waitlisted'
      order by x.registered_at
    loop
      seated   := public.nffga_tournament_seats_taken(p_tournament_id);
      teams_in := public.nffga_tournament_teams_entered(p_tournament_id);
      exit when t.max_players is not null and seated >= t.max_players;
      if (t.max_players is null or seated + (case when w.is_team then t.team_size else 1 end) <= t.max_players)
         and (not w.is_team or t.max_teams is null or teams_in < t.max_teams) then
        update public.nffga_tournament_registrations set status = 'registered' where id = w.id;
        promoted := coalesce(promoted, w.player_id);
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'promoted_player_id', promoted);
end; $$;
revoke all on function public.nffga_withdraw_from_tournament(uuid) from public, anon;
grant execute on function public.nffga_withdraw_from_tournament(uuid) to authenticated;


-- ── 8. Event requests from host departments ──────────────────────────

create table if not exists public.nffga_event_requests (
  id               uuid primary key default gen_random_uuid(),
  submitted_by     uuid references auth.users(id) on delete set null,
  department_name  text not null check (char_length(department_name) between 2 and 140),
  contact_name     text not null check (char_length(contact_name) between 2 and 120),
  contact_email    text not null check (char_length(contact_email) between 3 and 254),
  contact_phone    text check (contact_phone is null or char_length(contact_phone) <= 40),
  region           text check (region is null or char_length(region) <= 120),
  city             text check (city is null or char_length(city) <= 120),
  state            text check (state is null or char_length(state) <= 60),
  proposed_dates   text check (proposed_dates is null or char_length(proposed_dates) <= 500),
  course_name      text check (course_name is null or char_length(course_name) <= 140),
  course_city      text check (course_city is null or char_length(course_city) <= 120),
  expected_players integer check (expected_players is null or expected_players between 1 and 1000),
  format           text check (format is null or char_length(format) <= 140),
  beneficiary      text check (beneficiary is null or char_length(beneficiary) <= 300),
  notes            text check (notes is null or char_length(notes) <= 4000),
  status           text not null default 'submitted'
                   check (status in ('submitted', 'reviewing', 'approved', 'declined')),
  officer_notes    text check (officer_notes is null or char_length(officer_notes) <= 4000),  -- shown to the submitter
  tournament_id    uuid references public.nffga_tournaments(id) on delete set null,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists nffga_event_requests_submitted_by_idx on public.nffga_event_requests(submitted_by);
create index if not exists nffga_event_requests_status_idx       on public.nffga_event_requests(status, created_at desc);

drop trigger if exists nffga_event_requests_updated_at on public.nffga_event_requests;
create trigger nffga_event_requests_updated_at before update on public.nffga_event_requests
  for each row execute function public.nffga_touch_updated_at();

-- A status change records who reviewed it and when.
create or replace function public.nffga_event_requests_review_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'submitted' then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    new.reviewed_at := now();
  end if;
  return new;
end; $$;
revoke all on function public.nffga_event_requests_review_stamp() from public, anon, authenticated;
drop trigger if exists nffga_event_requests_review_stamp_trg on public.nffga_event_requests;
create trigger nffga_event_requests_review_stamp_trg
  before update on public.nffga_event_requests
  for each row execute function public.nffga_event_requests_review_stamp();

alter table public.nffga_event_requests enable row level security;
revoke all on public.nffga_event_requests from anon;
revoke all on public.nffga_event_requests from authenticated;
grant select on public.nffga_event_requests to authenticated;
grant insert (submitted_by, department_name, contact_name, contact_email, contact_phone, region, city, state,
              proposed_dates, course_name, course_city, expected_players, format, beneficiary, notes)
  on public.nffga_event_requests to authenticated;
grant update (status, officer_notes) on public.nffga_event_requests to authenticated;

drop policy if exists nffga_event_requests_insert on public.nffga_event_requests;
create policy nffga_event_requests_insert on public.nffga_event_requests
  for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'submitted' and tournament_id is null);

drop policy if exists nffga_event_requests_no_guests on public.nffga_event_requests;
create policy nffga_event_requests_no_guests on public.nffga_event_requests
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());

drop policy if exists nffga_event_requests_read on public.nffga_event_requests;
create policy nffga_event_requests_read on public.nffga_event_requests
  for select to authenticated
  using (submitted_by = auth.uid() or public.is_nffga_officer(auth.uid()));

drop policy if exists nffga_event_requests_officer_update on public.nffga_event_requests;
create policy nffga_event_requests_officer_update on public.nffga_event_requests
  for update to authenticated
  using (public.is_nffga_officer(auth.uid()))
  with check (public.is_nffga_officer(auth.uid()));

-- Approve: a draft tournament prefilled from the request. Idempotent —
-- a request already linked returns its tournament.
create or replace function public.nffga_create_tournament_from_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  q     public.nffga_event_requests;
  tid   uuid;
  fmt   text;
  tname text;
begin
  if uid is null or not public.is_nffga_officer(uid) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  select * into q from public.nffga_event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if q.tournament_id is not null and exists (select 1 from public.nffga_tournaments where id = q.tournament_id) then
    if q.status <> 'approved' then
      update public.nffga_event_requests set status = 'approved' where id = q.id;
    end if;
    return jsonb_build_object('ok', true, 'tournament_id', q.tournament_id, 'already_created', true);
  end if;

  fmt := lower(regexp_replace(btrim(coalesce(q.format, '')), '[\s-]+', '_', 'g'));
  if fmt not in ('scramble', 'shamble', 'best_ball', 'stroke_play', 'stableford', 'match_play', 'alternate_shot') then
    fmt := case when fmt = '' then 'scramble' else 'other' end;
  end if;
  tname := left(btrim(q.department_name) || ' Golf Tournament', 140);

  insert into public.nffga_tournaments (
    organizer_id, status, name, format, format_notes, beneficiary,
    course_name, course_city, course_state, max_players,
    host_department, sanctioned, contact_name, contact_email, contact_phone,
    waiver_required
  ) values (
    uid, 'draft', tname, fmt,
    case when fmt = 'other' then q.format end,
    q.beneficiary, q.course_name, coalesce(q.course_city, q.city), q.state, q.expected_players,
    q.department_name, true, q.contact_name, q.contact_email, q.contact_phone,
    true
  ) returning id into tid;

  update public.nffga_event_requests
    set tournament_id = tid, status = 'approved'
    where id = q.id;

  return jsonb_build_object('ok', true, 'tournament_id', tid);
end; $$;
revoke all on function public.nffga_create_tournament_from_request(uuid) from public, anon;
grant execute on function public.nffga_create_tournament_from_request(uuid) to authenticated;

commit;

-- DONE.
