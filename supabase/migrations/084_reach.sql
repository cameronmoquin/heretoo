-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 084: the reach number
-- ════════════════════════════════════════════════════════════════════════
-- An advertiser buys an audience, so the audience size is the one number
-- they are owed before they pay. This returns it: how many people are
-- here. Nothing per-person, nothing behavioural, no impressions, no
-- tracking. One integer about the whole platform.
--
-- Anon-callable on purpose: /advertise is a public page and the price is
-- computed from this number in front of the person paying it.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.heretoo_reach()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles;
$$;

revoke all on function public.heretoo_reach() from public, anon, authenticated;
grant execute on function public.heretoo_reach() to anon, authenticated;

notify pgrst, 'reload schema';

-- DONE.
