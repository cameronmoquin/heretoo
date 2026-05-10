-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 046: Donation transparency
-- ════════════════════════════════════════════════════════════════════════
-- Three things ship in this migration:
--
-- 1. donation_disbursements — a record of every payout from the
--    platform's Stripe balance to the beneficiary organization.
--    Whoever runs the platform writes one row per wire transfer or
--    check; the row carries the amount, the date, an optional
--    reference number, and a public note. Public-readable so anyone
--    can audit.
--
-- 2. profiles.is_donation_admin — a single boolean per profile that
--    grants access to the disbursement entry UI. Default false; the
--    platform owner flips theirs to true via SQL on first run.
--
-- 3. donation_transparency_report() RPC — a single aggregate query
--    returning total received, total disbursed, pending balance,
--    last disbursement date, and the running disbursement list. The
--    /give page reads this; nothing about individual donors is
--    exposed.
--
-- Refusal list:
--   - No donor names. Donations are anonymized in public reporting.
--   - No "top donors" leaderboard.
--   - No real-time notifications when someone gives.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Disbursement records ─────────────────────────────────────────────

create table if not exists public.donation_disbursements (
  id              uuid primary key default gen_random_uuid(),
  beneficiary     text not null,
  amount_cents    int not null check (amount_cents > 0),
  disbursed_at    date not null,
  -- ACH reference, check number, wire confirmation, etc.
  reference       text,
  -- Public note: "Q1 2026 quarterly disbursement" or similar.
  note            text,
  -- Internal: who recorded this. The platform may eventually have
  -- multiple admins; for now this just stamps accountability.
  recorded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists donation_disbursements_date_idx
  on public.donation_disbursements (disbursed_at desc);

alter table public.donation_disbursements enable row level security;

-- Public read — anyone signed in can audit. (We can lift this to anon
-- if /give/transparency becomes a public marketing page.)
drop policy if exists donation_disbursements_read on public.donation_disbursements;
create policy donation_disbursements_read on public.donation_disbursements
  for select to authenticated, anon using (true);

-- 2. Admin gate on profiles ──────────────────────────────────────────

alter table public.profiles
  add column if not exists is_donation_admin boolean not null default false;

-- Insert/update on disbursements limited to admins.
drop policy if exists donation_disbursements_admin_insert on public.donation_disbursements;
create policy donation_disbursements_admin_insert on public.donation_disbursements
  for insert to authenticated
  with check (
    auth.uid() = recorded_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_donation_admin = true
    )
  );

drop policy if exists donation_disbursements_admin_update on public.donation_disbursements;
create policy donation_disbursements_admin_update on public.donation_disbursements
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_donation_admin = true
    )
  );

drop policy if exists donation_disbursements_admin_delete on public.donation_disbursements;
create policy donation_disbursements_admin_delete on public.donation_disbursements
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_donation_admin = true
    )
  );

-- 3. Transparency report RPC ─────────────────────────────────────────

create or replace function public.donation_transparency_report()
returns table (
  total_received_cents   bigint,
  total_disbursed_cents  bigint,
  pending_cents          bigint,
  donor_count            int,
  disbursement_count     int,
  last_disbursed_at      date,
  current_beneficiary    text
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      coalesce(sum(amount_cents) filter (where status = 'succeeded'), 0)::bigint as received,
      count(distinct donor_user_id) filter (where status = 'succeeded')::int as donors,
      max(beneficiary) filter (where status = 'succeeded') as beneficiary
    from public.donations
  ),
  disbursed as (
    select
      coalesce(sum(amount_cents), 0)::bigint as paid,
      count(*)::int as n,
      max(disbursed_at) as last_at
    from public.donation_disbursements
  )
  select
    totals.received,
    disbursed.paid,
    (totals.received - disbursed.paid)::bigint,
    totals.donors,
    disbursed.n,
    disbursed.last_at,
    totals.beneficiary
  from totals, disbursed;
$$;

grant execute on function public.donation_transparency_report() to authenticated, anon;

-- 4. Helper: am I a donation admin? ──────────────────────────────────

create or replace function public.viewer_is_donation_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_donation_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.viewer_is_donation_admin() to authenticated;

-- DONE.
