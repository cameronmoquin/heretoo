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
-- THE TWO FIELDS THAT ARE A PERSON'S TO DECIDE:
--
--   storage_path   FILLED. The image is copied to heretoo.social rather
--                  than hotlinked, and carries no EXIF.
--   description    FILLED with Michael's own caption for the piece.
--                  Change it to anything you like before running; the
--                  guard only refuses a placeholder, not an edit.
--
-- The guard raises rather than inserting a placeholder, because a
-- half-filled ad row would render a live advertisement reading
-- REPLACE_ME to every reader.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── The two values a person decides ───────────────────────────────────
-- Both are filled. Edit either before running.
create temporary table _ad_input on commit drop as
select
  -- Hosted on heretoo.social, NOT hotlinked from scudieri.art. Michael
  -- gave permission for the image; hotlinking would still spend his
  -- bandwidth on every feed render and break the day he reorganises his
  -- site. Copied once, resized 3024x4032 -> 900x1200, 117KB, and EXIF
  -- stripped, because it is a phone photograph and those carry GPS.
  'https://heretoo.social/ads/jewels-by-deri.jpg'::text as storage_path,
  -- MICHAEL'S OWN CAPTION for this piece, from his page, not written
  -- here. Replace it with anything you prefer before running.
  'Custom platinum wedding band with a 3mm meteorite inlay. The octahedrite iron was sourced from the Aletai meteorite, China.'::text as description;


-- ── Refuse to ship a placeholder ──────────────────────────────────────
do $$
declare
  img  text;
  ad_copy text;
begin
  select storage_path, description into img, ad_copy from _ad_input;

  if img like 'REPLACE_ME%' or img is null or btrim(img) = '' then
    raise exception
      'storage_path is still the placeholder. Put the image URL Michael has approved into _ad_input, then re-run. An ad row with no real image renders a broken advertisement.';
  end if;

  if ad_copy like 'REPLACE_ME%' or ad_copy is null or btrim(ad_copy) = '' then
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
