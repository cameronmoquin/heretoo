-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 038: Always-on charitable fund
-- ════════════════════════════════════════════════════════════════════════
-- Donations route through Stripe (one-time payment, mode='payment').
-- The recipient organization is configured server-side in env vars
-- (DONATION_BENEFICIARY_NAME, DONATION_BENEFICIARY_URL) so the user
-- (the platform owner) can swap which 501(c)(3) or PAC receives the
-- funds without a code change.
--
-- Default placeholder: a registered 501(c)(3) focused on ending
-- homelessness, until the user (the platform owner) picks the
-- exact PAC they want to route to.
--
-- Refusal list:
--   - No anxiety-driven "donate now or else" copy. The Give button
--     is always present, never timed, never popup-modal.
--   - No "leaderboard" of donors. No public donor names.
--   - No matched-giving gimmicks unless they're real and audited.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.donations (
  id                       uuid primary key default gen_random_uuid(),
  donor_user_id            uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_checkout_id       text,
  amount_cents             int not null check (amount_cents > 0),
  currency                 text not null default 'usd',
  beneficiary              text not null,
  status                   text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists donations_donor_idx
  on public.donations (donor_user_id, created_at desc);
create index if not exists donations_status_idx
  on public.donations (status, created_at desc);

alter table public.donations enable row level security;

-- A donor sees their own giving history (tax purposes, plus the
-- quiet pride of a column titled "this is what you gave").
drop policy if exists donations_self_read on public.donations;
create policy donations_self_read on public.donations
  for select to authenticated
  using (auth.uid() = donor_user_id);

-- Inserts come from the Stripe webhook only (service role).

-- 2. Aggregate counter ────────────────────────────────────────────────
-- A platform-wide running total shown on the give surface — "X dollars
-- given so far across the platform." NOT public donor names; just the
-- total. Refreshed on each donation.

create or replace function public.donation_total_cents()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.donations
  where status = 'succeeded';
$$;

grant execute on function public.donation_total_cents() to authenticated, anon;

create or replace function public.touch_donations_updated_at()
returns trigger
language plpgsql
as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists donations_touch_updated on public.donations;
create trigger donations_touch_updated
  before update on public.donations
  for each row execute function public.touch_donations_updated_at();

-- DONE.
