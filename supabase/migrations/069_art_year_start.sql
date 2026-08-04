-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 069: a year you can actually filter on
-- ════════════════════════════════════════════════════════════════════════
-- THE PROBLEM. art_works.year_created is `text` holding whatever each
-- museum API called a date. Real values from the table:
--
--   1860
--   c 1900
--   19th century
--   1870s
--   c. 1475–1500
--   09/19/1887
--   Sunday, September 14, 1119 (year 239 of the Newar Samvat in the
--     month of Ashvina)
--
-- Nothing can filter on that in SQL, so hooks/useArtFeed.ts pulled a
-- 5000-row pool and bucketed it in JS with parseYear. That was fine when
-- the gallery was a few thousand works. It is now 104,183, so every era
-- filter has been deciding against roughly 5% of the collection — pick a
-- narrow era and you get a handful of results while thousands sit
-- unqueried. The code comment at POOL_SIZE records this happening once
-- already at 1000 and being "fixed" by raising the cap to 5000.
--
-- Raising the cap again is not the fix. Filtering server-side is, and
-- that needs a real integer.
--
-- WHAT year_start MEANS. The earliest year the free text plausibly
-- refers to. A range ("c. 1475–1500") takes its start. A century
-- ("19th century") takes the first year of that century, 1800 — which
-- is what ERA_RANGES already assumes when it buckets. Approximation
-- markers (c., ca., circa) are ignored rather than fudged; nothing here
-- pretends to more precision than the museum gave.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. The parser ────────────────────────────────────────────────────
-- Ordered on purpose. The century branch has to run first: "19th
-- century" contains no 3-or-4 digit run, so the digit branch would
-- return null and the work would fall out of every era.
--
-- IMMUTABLE so it can back a generated column or an expression index
-- later if this ever needs to be recomputed in place.
create or replace function public.art_year_start(raw text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when raw is null or btrim(raw) = '' then null

    -- "19th century", "19th-century", "late 18th century", "18th–19th
    -- century" (takes the first century named). 19th century → 1800.
    when raw ~* '\d{1,2}\s*(st|nd|rd|th)[\s-]+century' then
      ((substring(raw from '(\d{1,2})\s*(?:st|nd|rd|th)[\s-]+century'))::int - 1) * 100
        * (case when raw ~* 'b\.?\s?c\.?' then -1 else 1 end)

    -- Otherwise the first run of 3 or 4 digits. Deliberately not \d+:
    -- two-digit runs are days and months ("09/19/1887" must give 1887,
    -- not 9), and a 4-digit cap keeps accession numbers from winning.
    when raw ~ '\d{3,4}' then
      (substring(raw from '(\d{3,4})'))::int
        * (case when raw ~* 'b\.?\s?c\.?' then -1 else 1 end)

    else null
  end
$$;


-- ── 2. The column, backfilled ────────────────────────────────────────
-- Nullable on purpose. A work whose date string yields nothing keeps a
-- null year_start and simply does not match an era filter — the same
-- outcome parseYear gave it in JS, rather than being quietly assigned
-- to some default century.
alter table public.art_works
  add column if not exists year_start integer;

update public.art_works
   set year_start = public.art_year_start(year_created)
 where year_start is null
   and year_created is not null;


-- ── 3. Indexes for the filters that move server-side ─────────────────
-- year_start carries the era buckets. genre is text[] and gets a GIN
-- index so an overlap test on the selected genres stays cheap.
create index if not exists art_works_year_start_idx
  on public.art_works(year_start);

create index if not exists art_works_genre_gin_idx
  on public.art_works using gin(genre);


-- ── 4. Verify ────────────────────────────────────────────────────────
-- Spot-check the hard cases, then confirm the era buckets are populated:
--
--   select year_created, public.art_year_start(year_created)
--     from public.art_works
--    where year_created in ('19th century', 'c. 1475–1500', '09/19/1887', '1870s');
--   -- expect 1800, 1475, 1887, 1870
--
--   select count(*) filter (where year_start between 1900 and 1999) as modern,
--          count(*) filter (where year_start >= 2000)               as contemporary,
--          count(*) filter (where year_start is null)               as unparsed
--     from public.art_works;

-- DONE.
