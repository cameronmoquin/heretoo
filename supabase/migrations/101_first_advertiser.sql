-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 101. The first advertiser.
-- ════════════════════════════════════════════════════════════════════════
-- Jewels by D'eri — Michael Scudieri. Carried free.
--
-- WHY THIS ONE FITS, since the ads doctrine says creative bends to the
-- house and the house is "a writer, in Providence": Jewels by D'eri
-- began in Providence. Ralph Scudieri brought it there from Foggia when
-- the city was the jewelry capital of the United States, trained his
-- son, who trained Michael. Three generations of the same bench. The
-- shop is in Seattle now and the work is fine jewelry, by appointment.
-- (Facts from the business's own page, scudieri.art/jewels-by-d-eri,
-- read 2026-09-24. Nothing here is invented and nothing is puffed.)
--
-- HOW AN AD EXISTS HERE. There is no self-serve and no ad network: an
-- ad is one hand-placed row in public.art_works with source='ad'. It
-- rides the same rotation slots as the gallery, wears a "Sponsored" tag
-- (ArtSlot), and links out to source_url. That is the whole mechanism,
-- and it is deliberately editorial — someone decides, by hand, one row
-- at a time.
--
-- TWO FIELDS THIS FILE CANNOT FILL, and it refuses to run until they
-- are filled:
--
--   storage_path   The image. ArtSlot uses this value directly as the
--                  <Image> uri, so an absolute URL works as well as a
--                  bucket path. IT MUST BE AN IMAGE MICHAEL HAS GIVEN
--                  PERMISSION TO USE. Do not point it at a file lifted
--                  from his site without asking him; it is his work and
--                  the whole premise here is that he is a friend of the
--                  house, not a scraped logo.
--
--   description    The ad copy. Every user-facing line on this platform
--                  is written by its owner, and an advertisement is the
--                  last place to make an exception. Write it, or ask
--                  Michael for a line and use his.
--
-- The guard at the top raises rather than inserting a placeholder,
-- because a half-filled ad row would render as a live advertisement
-- carrying the word REPLACE_ME to every reader.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── The two values a person must supply ───────────────────────────────
-- Edit these two lines, then run the file.
create temporary table _ad_input on commit drop as
select
  'REPLACE_ME_image_url'::text  as storage_path,
  'REPLACE_ME_ad_copy'::text    as description;


-- ── Refuse to ship a placeholder ──────────────────────────────────────
do $$
declare
  img  text;
  copy text;
begin
  select storage_path, description into img, copy from _ad_input;

  if img like 'REPLACE_ME%' or img is null or btrim(img) = '' then
    raise exception
      'storage_path is still the placeholder. Put the image URL Michael has approved into _ad_input, then re-run. An ad row with no real image renders a broken advertisement.';
  end if;

  if copy like 'REPLACE_ME%' or copy is null or btrim(copy) = '' then
    raise exception
      'description is still the placeholder. The ad copy is written by the owner (or by Michael), never generated. Put the real line into _ad_input, then re-run.';
  end if;
end$$;


-- ── The row ───────────────────────────────────────────────────────────
-- source_id is the stable key this file matches on, so a re-run updates
-- the creative rather than stacking a second advertisement.
insert into public.art_works (
  source, source_id, title, artist, year_created,
  storage_path, license, source_url, description
)
select
  'ad',
  'jewels-by-deri',
  'Jewels by D''eri',
  'Michael Scudieri',
  -- Three generations, and the business says "over 70 years".
  'est. Providence, RI',
  i.storage_path,
  -- license is NOT NULL and ArtSlot only renders it for gallery pieces,
  -- never for an ad. It records provenance for the next reader of this
  -- table rather than anything a user sees.
  'Used with the advertiser''s permission',
  'https://scudieri.art/jewels-by-d-eri',
  i.description
from _ad_input i
on conflict do nothing;

-- If the row already existed, refresh the creative in place.
update public.art_works a
   set storage_path = i.storage_path,
       description  = i.description,
       source_url   = 'https://scudieri.art/jewels-by-d-eri'
  from _ad_input i
 where a.source = 'ad' and a.source_id = 'jewels-by-deri';


-- ── Say what landed ───────────────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.art_works where source = 'ad';
  raise notice 'art_works now carries % advertisement(s).', n;
  raise notice 'Ads only reach a reader whose art preference is art_and_ads — see stores/artPrefsStore.ts.';
end$$;

commit;

notify pgrst, 'reload schema';

-- TO PULL THE AD LATER:
--   delete from public.art_works where source = 'ad' and source_id = 'jewels-by-deri';
--
-- DONE.
