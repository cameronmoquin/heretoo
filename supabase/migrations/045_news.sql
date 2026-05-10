-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 045: News from public broadcasting
-- ════════════════════════════════════════════════════════════════════════
-- A news layer that pulls headlines from public-broadcasting RSS feeds
-- (NPR, BBC, PBS NewsHour) and surfaces them in HereToo. Calm, fact-
-- based, no algorithm. The publisher gets the click-through; HereToo
-- gets the curated reading list.
--
-- Sources are public broadcasters by design. The platform doesn't
-- substitute for the source — every item links out for the full piece.
-- We only display the headline + a 2-3 sentence summary, the
-- standard fair-use practice for news aggregators.
--
-- Scope:
--   - Global: BBC World, NPR World
--   - National (US): NPR Top Stories, PBS NewsHour
--   - Local: deferred. Will require user location + per-state public
--     radio affiliate mapping. Coming.
--
-- Refusal list:
--   - No paywalled sources (NYT, Washington Post, etc.). Public
--     broadcasting only.
--   - No partisan-trending lists ranked by engagement.
--   - No comments threads on news items inside HereToo. Discussion
--     happens in family Subjects, not on the news layer.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.news_items (
  id            uuid primary key default gen_random_uuid(),
  source        text not null check (source in ('npr', 'bbc', 'pbs', 'apnews')),
  source_label  text not null,
  category      text not null check (category in ('global', 'national', 'arts', 'science')),
  headline      text not null,
  summary       text,
  url           text not null,
  image_url     text,
  published_at  timestamptz not null,
  fetched_at    timestamptz not null default now(),
  -- Hash of url + headline for de-dup across re-polls.
  fingerprint   text not null unique
);

create index if not exists news_items_published_idx
  on public.news_items (published_at desc);
create index if not exists news_items_category_idx
  on public.news_items (category, published_at desc);

alter table public.news_items enable row level security;

-- News is platform-wide and visible to anyone signed in.
drop policy if exists news_items_read on public.news_items;
create policy news_items_read on public.news_items
  for select to authenticated using (true);

-- Inserts come exclusively from the service-role poll function.

-- 2. RPC: today's headline rotation for the Room hearth ──────────────
-- Picks one item per category for the day. The Room shows the
-- "global" line; users can swipe through if we surface a tabbed
-- news card, or just see the rotation.

create or replace function public.todays_news_rotation()
returns table (
  id           uuid,
  source_label text,
  category     text,
  headline     text,
  summary      text,
  url          text,
  image_url    text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with today_items as (
    select *,
      row_number() over (partition by category order by published_at desc) as rn
    from public.news_items
    where published_at > (now() - interval '24 hours')
  )
  select id, source_label, category, headline, summary, url, image_url, published_at
  from today_items
  where rn = 1
  order by
    case category
      when 'global'   then 1
      when 'national' then 2
      when 'arts'     then 3
      when 'science'  then 4
      else 5
    end;
$$;

grant execute on function public.todays_news_rotation() to authenticated;

-- DONE.
