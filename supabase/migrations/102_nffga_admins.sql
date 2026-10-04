-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 102: Admins and officers
-- ════════════════════════════════════════════════════════════════════════
-- Who runs the association. Two tables, five RPCs, nothing else.
--
--   nffga_admin_designations  An EMAIL and the seat it is entitled to.
--                             Written only by these RPCs and the seed.
--   nffga_officers            A USER and the seat they hold. Written only
--                             by claim_admin_seat(). No client write path.
--
-- THE SEATS (2026-10-04, Cameron):
--   super_admin     cameron.moquin@gmail.com. Seeded here. The only role
--                   no RPC can grant or revoke.
--   managing_admin  Timothy O'Reilly, whatever email he uses. Designated
--                   by the super admin from the /admin screen.
--   admin, president, director, tournament_chair, treasurer, secretary
--                   Designated by the super admin or the managing admin.
--
-- WHY A DESIGNATION IS NOT ENOUGH ON ITS OWN. This database belongs to
-- the EMSPCR project and, as of 2026-10-04, AUTO-CONFIRMS new emails
-- (/auth/v1/settings reports mailer_autoconfirm: true). Under that
-- setting anyone can sign up as cameron.moquin@gmail.com with a password
-- of their choosing and hold a session whose email claim says so. An
-- RPC that seated whoever's JWT carried a designated email would hand
-- the super admin seat to whoever registered that address first.
--
-- So the FIRST claim of a seat requires a session created by an emailed
-- link or code — the JWT's `amr` must include method 'otp' (or the older
-- 'magiclink'). That proves the person controls the inbox, whatever the
-- confirmation setting. A password session cannot claim a seat; it can
-- only use one it already holds. The /admin screen offers the email link
-- for exactly this.
--
-- And a seat binds to ONE user id. If a designation was already claimed
-- by a different account, a second account with the same email (possible
-- only through dashboard tampering) is refused rather than re-seated.
--
-- NO DEPENDENCY ON public.profiles. EMSPCR already has its own profiles
-- table; HereToo's has not been applied and may never be in this form.
-- Officers reference auth.users directly, so this file runs first and
-- runs alone.
--
-- Run BY HAND in the dashboard SQL editor of project avepftawrkwytlohobjh
-- (EMSPCR). NEVER evryruyibfibaplzurik (HereToo). Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Tables ────────────────────────────────────────────────────────

create table if not exists public.nffga_admin_designations (
  email          text primary key check (email = lower(btrim(email)) and email like '%_@_%._%'),
  role           text not null check (role in (
                   'super_admin', 'managing_admin', 'admin', 'president', 'director',
                   'tournament_chair', 'treasurer', 'secretary')),
  designated_by  uuid references auth.users(id) on delete set null,
  designated_at  timestamptz not null default now(),
  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz
);

create table if not exists public.nffga_officers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in (
                'super_admin', 'managing_admin', 'admin', 'president', 'director',
                'tournament_chair', 'treasurer', 'secretary')),
  created_at  timestamptz not null default now()
);

alter table public.nffga_admin_designations enable row level security;
alter table public.nffga_officers           enable row level security;

-- Officers are public to signed-in members: who runs the association is
-- not a secret. Deliberately NO insert / update / delete policy.
drop policy if exists nffga_officers_read on public.nffga_officers;
create policy nffga_officers_read on public.nffga_officers
  for select to authenticated using (true);


-- ── 2. Reading a seat ────────────────────────────────────────────────

create or replace function public.is_nffga_officer(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.nffga_officers where user_id = p_profile_id);
$$;
revoke all on function public.is_nffga_officer(uuid) from public, anon;
grant execute on function public.is_nffga_officer(uuid) to authenticated;

create or replace function public.nffga_role_of(p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.nffga_officers where user_id = p_user_id;
$$;
revoke all on function public.nffga_role_of(uuid) from public, anon;
grant execute on function public.nffga_role_of(uuid) to authenticated;

-- Designations are visible to officers only. (The table has no client
-- write policy either; the RPCs below are the only writers.)
drop policy if exists nffga_admin_designations_read on public.nffga_admin_designations;
create policy nffga_admin_designations_read on public.nffga_admin_designations
  for select to authenticated using (public.is_nffga_officer(auth.uid()));


-- ── 3. Claiming a seat ───────────────────────────────────────────────

create or replace function public.claim_admin_seat()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  em      text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  held    text;
  d       public.nffga_admin_designations;
  by_link boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  -- Already seated: nothing to prove again.
  select role into held from public.nffga_officers where user_id = uid;
  if found then
    return jsonb_build_object('ok', true, 'role', held);
  end if;

  select * into d from public.nffga_admin_designations where email = em for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_designated');
  end if;

  if d.claimed_by is not null and d.claimed_by <> uid then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'magiclink')
  ) into by_link;
  if not by_link then
    return jsonb_build_object('ok', false, 'error', 'email_link_required');
  end if;

  insert into public.nffga_officers (user_id, role) values (uid, d.role)
    on conflict (user_id) do update set role = excluded.role;
  update public.nffga_admin_designations
    set claimed_by = uid, claimed_at = now()
    where email = d.email;

  return jsonb_build_object('ok', true, 'role', d.role, 'claimed', true);
end; $$;
revoke all on function public.claim_admin_seat() from public, anon;
grant execute on function public.claim_admin_seat() to authenticated;


-- ── 4. Granting and revoking ─────────────────────────────────────────
-- Super admin may designate any role except super_admin. Managing admin
-- may designate any role below managing_admin. Nobody revokes upward.

create or replace function public.nffga_role_rank(p_role text)
returns int language sql immutable as $$
  select case
    when p_role is null              then 0
    when p_role = 'super_admin'      then 3
    when p_role = 'managing_admin'   then 2
    else 1
  end;
$$;

create or replace function public.designate_admin(p_email text, p_role text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me    text := public.nffga_role_of(auth.uid());
  em    text := lower(btrim(coalesce(p_email, '')));
  prior public.nffga_admin_designations;
  had_prior boolean;
begin
  if me is null or public.nffga_role_rank(me) < 2 then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;
  if p_role not in ('managing_admin', 'admin', 'president', 'director', 'tournament_chair', 'treasurer', 'secretary') then
    return jsonb_build_object('ok', false, 'error', 'bad_role');
  end if;
  if public.nffga_role_rank(p_role) >= public.nffga_role_rank(me) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  select * into prior from public.nffga_admin_designations where email = em;
  had_prior := found;
  if had_prior and public.nffga_role_rank(prior.role) >= public.nffga_role_rank(me) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  insert into public.nffga_admin_designations (email, role, designated_by)
    values (em, p_role, auth.uid())
  on conflict (email) do update
    set role = excluded.role, designated_by = excluded.designated_by, designated_at = now();

  -- Someone already seated under this email takes the new role at once.
  if had_prior and prior.claimed_by is not null then
    update public.nffga_officers set role = p_role where user_id = prior.claimed_by;
  end if;

  return jsonb_build_object('ok', true, 'email', em, 'role', p_role);
end; $$;
revoke all on function public.designate_admin(text, text) from public, anon;
grant execute on function public.designate_admin(text, text) to authenticated;

create or replace function public.revoke_admin(p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me  text := public.nffga_role_of(auth.uid());
  em  text := lower(btrim(coalesce(p_email, '')));
  d   public.nffga_admin_designations;
begin
  if me is null or public.nffga_role_rank(me) < 2 then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  select * into d from public.nffga_admin_designations where email = em;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if public.nffga_role_rank(d.role) >= public.nffga_role_rank(me) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  if d.claimed_by is not null then
    delete from public.nffga_officers where user_id = d.claimed_by;
  end if;
  delete from public.nffga_admin_designations where email = em;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.revoke_admin(text) from public, anon;
grant execute on function public.revoke_admin(text) to authenticated;

-- The roster an admin screen shows. Officers only.
create or replace function public.list_nffga_admins()
returns table (email text, role text, claimed boolean, designated_at timestamptz, claimed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.email, d.role, d.claimed_by is not null, d.designated_at, d.claimed_at
  from public.nffga_admin_designations d
  where public.is_nffga_officer(auth.uid())
  order by public.nffga_role_rank(d.role) desc, d.designated_at;
$$;
revoke all on function public.list_nffga_admins() from public, anon;
grant execute on function public.list_nffga_admins() to authenticated;


-- ── 5. Seed ──────────────────────────────────────────────────────────
-- The super admin is a designation, not a seated row, on purpose: even if
-- an account for this address already exists in this shared auth table,
-- it is seated only when someone proves the inbox via the email link.

insert into public.nffga_admin_designations (email, role)
values ('cameron.moquin@gmail.com', 'super_admin')
on conflict (email) do nothing;

commit;

-- DONE.
