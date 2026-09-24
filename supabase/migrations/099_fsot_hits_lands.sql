-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 099. The study guide's beacon finally has somewhere
-- to land.
-- ════════════════════════════════════════════════════════════════════════
-- All 85 pages under public/fsot/ have been firing an analytics beacon at
-- `public.fsot_hits` since the guide shipped. The table was never created.
-- Every one of those requests has come back PGRST205 — "could not find the
-- table in the schema cache" — and been swallowed by the beacon's own
-- .catch(function(){}).
--
-- So the instrumentation is right and the measurement is zero. There is no
-- record of how many people have read the guide, where they came from, or
-- how many finished a drill. Every question about the funnel is currently
-- answered by guessing.
--
-- WHAT THE BEACON SENDS. From the inline script at the foot of each page:
--
--   window.fsotHit = function(ev, ep) {
--     fetch('.../rest/v1/fsot_hits', { method:'POST', keepalive:true,
--       headers: { apikey: <publishable>, Prefer: 'return=minimal' },
--       body: JSON.stringify({ page: location.pathname, event: ev,
--         episode: ep || null,
--         ref: ev === 'view' ? (document.referrer || null) : null }) })
--   };
--
-- Three events exist today:
--   view      fired on every page load (85 pages). `ref` carries
--             document.referrer, the only evidence of how anyone arrives.
--   play      fired by the 59 audio episode pages when playback starts.
--             This is the whole audio course's only feedback channel.
--   complete  fired by drill.js when the final part of a drill is ordered
--             perfectly, with episode = 'drill:<lessonId>'. This is the
--             high-intent signal — whoever reaches it chose to finish.
--
-- THE `event` COLUMN IS DELIBERATELY NOT AN ENUM OR A CHECK LIST. The
-- first draft of this file constrained it to ('view','complete') — which
-- would have silently rejected all 59 audio pages, reproducing the exact
-- bug this migration exists to fix, in the file that fixes it. A beacon
-- whose rows are refused is indistinguishable from a beacon nobody fires.
-- A new event type must LAND and be visible, not be dropped for failing a
-- vocabulary written before it existed. Length is capped; meaning is not.
--
-- THIS TABLE IS A PUBLIC WRITE DOOR, on purpose. The guide is static HTML
-- served to logged-out readers; the beacon carries the publishable key and
-- writes as `anon`. That is the only way a static page can report anything.
-- The cost is that anyone who reads the page source can post junk rows.
-- It is bounded rather than prevented:
--   - every column is length-capped, so a row cannot be large (length
--     only — the `event` VOCABULARY is deliberately open, see above)
--   - the table holds NO personal data: no id, no cookie, no address, no
--     fingerprint. A row says a page was viewed and what site linked to it.
--     Nothing in it identifies a person, which is also why it needs no
--     consent banner.
--   - there is NO read policy, so no client can read a single row back
--
-- Reading is done by the owner in the dashboard SQL editor, where postgres
-- owns the table and RLS does not apply. The queries worth running are at
-- the bottom of this file.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The table ──────────────────────────────────────────────────────
-- uuid rather than bigserial deliberately: a sequence would need its own
-- USAGE grant to `anon`, which is one more privilege to get wrong on a
-- table whose whole risk surface is a public insert.
create table if not exists public.fsot_hits (
  id         uuid primary key default gen_random_uuid(),
  page       text not null check (char_length(page) between 1 and 200),
  event      text not null check (char_length(event) between 1 and 40),
  episode    text check (episode is null or char_length(episode) <= 120),
  ref        text check (ref is null or char_length(ref) <= 500),
  created_at timestamptz not null default now()
);

alter table public.fsot_hits enable row level security;


-- ── 2. Write-only, for everyone ───────────────────────────────────────
-- `to anon, authenticated` because the guide is read logged-out by
-- design and the beacon has no session.
drop policy if exists fsot_hits_insert on public.fsot_hits;
create policy fsot_hits_insert on public.fsot_hits
  for insert to anon, authenticated
  with check (true);

-- No SELECT, UPDATE or DELETE policy, so those match zero rows for every
-- non-bypassing role. The revoke below is the second lock: Supabase
-- grants ALL on new public tables by default, and the grant is what
-- PostgREST actually consults first.
revoke all on public.fsot_hits from anon, authenticated;
grant insert on public.fsot_hits to anon, authenticated;


-- ── 3. Indexes for the questions that will actually be asked ──────────
-- "where is traffic coming from" and "how many finished a drill" both
-- filter on event and sort by time.
create index if not exists fsot_hits_event_time on public.fsot_hits (event, created_at desc);
create index if not exists fsot_hits_page_time  on public.fsot_hits (page, created_at desc);


commit;

-- PostgREST caches the schema, and right now that cache is the reason
-- every beacon 404s. Reload so the table is live immediately.
notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════
-- THE QUERIES. Paste any of these into the SQL editor once data lands.
-- ════════════════════════════════════════════════════════════════════════
--
-- Is anything arriving at all?
--   select count(*), min(created_at), max(created_at) from public.fsot_hits;
--
-- How do people find the guide? (the question no amount of research can
-- answer — '' is a direct hit, a bookmark, or a stripped referrer)
--   select coalesce(nullif(ref, ''), '(direct)') as source, count(*)
--   from public.fsot_hits where event = 'view'
--   group by 1 order by 2 desc limit 30;
--
-- Which pages hold people?
--   select page, count(*) from public.fsot_hits
--   where event = 'view' group by 1 order by 2 desc limit 30;
--
-- What is actually being fired? Run this first — it also catches any new
-- event type added later, which a CHECK list would have hidden.
--   select event, count(*) from public.fsot_hits group by 1 order by 2 desc;
--
-- THE HIGH-INTENT NUMBER. Whoever reaches this finished a drill on
-- purpose. This count is the denominator for any offer worth making.
--   select episode, count(*) from public.fsot_hits
--   where event = 'complete' group by 1 order by 2 desc;
--
-- Which audio episodes are actually listened to? (59 pages fire this)
--   select page, count(*) from public.fsot_hits
--   where event = 'play' group by 1 order by 2 desc limit 30;
--
-- The conversion question, stated honestly:
--   select
--     count(*) filter (where event = 'view')     as views,
--     count(*) filter (where event = 'complete') as drills_finished,
--     round(100.0 * count(*) filter (where event = 'complete')
--           / nullif(count(*) filter (where event = 'view'), 0), 2) as pct
--   from public.fsot_hits;
--
-- Daily shape, to see whether anything is growing:
--   select date_trunc('day', created_at)::date as day,
--          count(*) filter (where event = 'view') as views,
--          count(*) filter (where event = 'complete') as finished
--   from public.fsot_hits group by 1 order by 1 desc limit 30;
--
-- DONE.
