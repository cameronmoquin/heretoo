-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 035: Economics (Source of Truth, Milestone 12)
-- ════════════════════════════════════════════════════════════════════════
-- $5/month or $50/year per family. Paid by the family for the family.
-- The grandmother never sees a price; the granddaughter does. Money is
-- a phenomenological signal: a paid product is owned by its users.
--
-- A family's first family is free (capped at 5 members, read-only after
-- cap). Additional families and large families require a subscription.
-- Letters with deliver_at >30 days out, voice cloning, and printed
-- welcome cards are also gated.
--
-- 80% of the platform's surface stays free. The 20% that pays is the
-- long-horizon investment surface. People pay for things that compound
-- over time. They should not pay for the basic right to dwell.
--
-- Refusal list (M12):
--   - No advertising. Ever.
--   - No data sale. Ever.
--   - No third-party SDKs that surveil.
--   - No referral kickbacks.
--   - No tiered features for grandmother vs granddaughter.
--   - No "premium" badges on profiles.
--   - No payment-related anxiety pushes.
-- ════════════════════════════════════════════════════════════════════════

-- 1. subscriptions ────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  family_id                uuid references public.families(id) on delete cascade,
  payer_user_id            uuid references public.profiles(id) on delete set null,
  stripe_customer_id       text,
  stripe_subscription_id   text unique,
  plan                     text not null check (plan in ('monthly','annual','gift_annual','memorial','grandfathered')),
  status                   text not null check (status in (
    'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid'
  )),
  current_period_end       timestamptz,
  member_cap               int not null default 25,
  -- For memorial families (free for life), payer_user_id may be null
  -- and stripe_subscription_id remains null. The status is 'active'
  -- and current_period_end is null (no expiration).
  is_memorial              boolean not null default false,
  -- 30-day grace period start, set when the latest invoice fails.
  grace_started_at         timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_family_idx
  on public.subscriptions (family_id);
create index if not exists subscriptions_payer_idx
  on public.subscriptions (payer_user_id);
create unique index if not exists subscriptions_active_per_family_idx
  on public.subscriptions (family_id) where status in ('active', 'trialing', 'past_due');

alter table public.subscriptions enable row level security;

-- Read: any active member of the family + the payer (cross-family
-- visibility for "this family is on a paid plan" indicator). The
-- payer's own row is always visible to them.
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated
  using (
    auth.uid() = payer_user_id
    or (
      family_id is not null and exists (
        select 1 from public.family_members fm
        where fm.family_id = subscriptions.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )
  );

-- Inserts come exclusively from the Stripe webhook (service-role).

-- 2. billing_events — audit trail ─────────────────────────────────────

create table if not exists public.billing_events (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid references public.subscriptions(id) on delete cascade,
  family_id           uuid references public.families(id) on delete set null,
  -- Plain, low-cardinality verb so analytics stays bounded.
  kind                text not null check (kind in (
    'created', 'renewed', 'canceled', 'gifted', 'memorial_granted',
    'payment_succeeded', 'payment_failed', 'grace_started', 'grace_ended'
  )),
  amount_cents        int,
  stripe_event_id     text unique,
  occurred_at         timestamptz not null default now()
);

create index if not exists billing_events_sub_idx
  on public.billing_events (subscription_id, occurred_at desc);

alter table public.billing_events enable row level security;

-- Family members + payer can see billing events for their family
-- (transparency).
drop policy if exists billing_events_read on public.billing_events;
create policy billing_events_read on public.billing_events
  for select to authenticated
  using (
    family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = billing_events.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- 3. Helper: family subscription summary ──────────────────────────────
-- Used by the family page header to show a low-key "On a plan" / "On
-- a free plan" indicator. Returns the family's active subscription
-- if any. Never panics if there is no subscription.

create or replace function public.family_subscription_summary(p_family_id uuid)
returns table (
  status         text,
  plan           text,
  is_memorial    boolean,
  member_cap     int,
  in_grace       boolean,
  current_period_end timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.status,
    s.plan,
    s.is_memorial,
    s.member_cap,
    (s.grace_started_at is not null and s.grace_started_at > now() - interval '30 days') as in_grace,
    s.current_period_end
  from public.subscriptions s
  where s.family_id = p_family_id
    and s.status in ('active', 'trialing', 'past_due')
  order by s.created_at desc
  limit 1;
$$;

grant execute on function public.family_subscription_summary(uuid) to authenticated;

-- 4. Trigger: bump updated_at on subscription change ──────────────────

create or replace function public.touch_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated on public.subscriptions;
create trigger subscriptions_touch_updated
  before update on public.subscriptions
  for each row execute function public.touch_subscriptions_updated_at();

-- DONE.
