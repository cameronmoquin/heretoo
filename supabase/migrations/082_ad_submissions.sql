-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 082: the ad counter opens
-- ════════════════════════════════════════════════════════════════════════
-- Anyone may apply; the artistic standard decides. A submission is an
-- application, not a purchase — approval comes first, payment after,
-- so no one ever buys their way past the aesthetic.
--
-- Small business only (a jeweler, an Etsy profile, the ice-cream
-- shop). Targeting is three DECLARED slots — age, gender identity,
-- location — newspaper advertising, not surveillance advertising.
--
-- Clients may only INSERT. Review happens with the service role;
-- an approved submission becomes a hand-placed art_works row with
-- source='ad', same as ever.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.ad_submissions (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null check (length(trim(business_name)) between 2 and 120),
  contact_email text not null check (contact_email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  link          text,
  pitch         text not null check (length(trim(pitch)) between 10 and 2000),
  target_age    text,
  target_gender text,
  target_location text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);

alter table public.ad_submissions enable row level security;
revoke all on table public.ad_submissions from public, anon, authenticated;
grant insert on table public.ad_submissions to anon, authenticated;

drop policy if exists ad_submissions_apply on public.ad_submissions;
create policy ad_submissions_apply on public.ad_submissions
  for insert to anon, authenticated
  with check (true);

-- No select/update/delete policies for clients: the counter takes
-- applications, it does not display them. Review rides the service
-- role.

notify pgrst, 'reload schema';

-- DONE.
