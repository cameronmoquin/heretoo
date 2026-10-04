-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 108: Gear listing terms, and photos on posts
-- ════════════════════════════════════════════════════════════════════════
-- Cameron, 2026-10-04: "photos in the feed and especially for the gear
-- trade. they should be able to upload lets say 5 photos. a description,
-- new/used/ mint/great/good/fair/poor condition. price. if it is
-- negotiable. shipping or local pickup- arrange shipping in the
-- messenger".
--
-- 1. Gear condition is now the seller's scale:
--      new · mint · great · good · fair · poor
--    (everything but "new" is used). Old values map like_new → mint and
--    worn → poor; there were no listings when this was written.
-- 2. nffga_gear_listings.negotiable — the price is open to offers.
-- 3. At most FIVE photos per listing, enforced here (position 0..4), not
--    just in the form.
-- 4. Clubhouse posts carry up to FIVE photos: nffga_posts.photo_paths
--    text[]. The old single photo_path stays (the first photo is mirrored
--    into it) so nothing that reads it breaks. A post needs words or at
--    least one photo.
--
-- Shipping stays local_only / will_ship / either; the app labels them
-- Local pickup / Will ship / Pickup or ship, and arranging shipping
-- happens in Messages — no addresses or payments are stored here.
--
-- Only nffga_ objects are touched. Project avepftawrkwytlohobjh.
-- Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Condition scale ───────────────────────────────────────────────
alter table public.nffga_gear_listings drop constraint if exists nffga_gear_listings_condition_check;
update public.nffga_gear_listings set condition = 'mint' where condition = 'like_new';
update public.nffga_gear_listings set condition = 'poor' where condition = 'worn';
alter table public.nffga_gear_listings
  add constraint nffga_gear_listings_condition_check
  check (condition in ('new', 'mint', 'great', 'good', 'fair', 'poor'));

-- ── 2. Negotiable ────────────────────────────────────────────────────
alter table public.nffga_gear_listings
  add column if not exists negotiable boolean not null default false;

-- ── 3. Five photos per listing ───────────────────────────────────────
alter table public.nffga_gear_photos drop constraint if exists nffga_gear_photos_max_five;
alter table public.nffga_gear_photos
  add constraint nffga_gear_photos_max_five check (position between 0 and 4);

-- ── 4. Photos on Clubhouse posts ─────────────────────────────────────
alter table public.nffga_posts
  add column if not exists photo_paths text[] not null default '{}';

alter table public.nffga_posts drop constraint if exists nffga_posts_photo_paths_max_five;
alter table public.nffga_posts
  add constraint nffga_posts_photo_paths_max_five check (cardinality(photo_paths) <= 5);

-- A post needs words, a photo, or photos.
alter table public.nffga_posts drop constraint if exists nffga_posts_body_or_photo;
alter table public.nffga_posts
  add constraint nffga_posts_body_or_photo check (
    char_length(body) <= 4000
    and (char_length(btrim(body)) >= 1 or photo_path is not null or cardinality(photo_paths) >= 1)
  );

-- Keep photo_path = the first photo, so any reader of the old column
-- still sees a picture.
create or replace function public.nffga_posts_mirror_first_photo()
returns trigger language plpgsql set search_path = public as $$
begin
  if cardinality(new.photo_paths) >= 1 then
    new.photo_path := new.photo_paths[1];
  elsif tg_op = 'UPDATE' and new.photo_paths is distinct from old.photo_paths then
    new.photo_path := null;
  end if;
  return new;
end; $$;
revoke all on function public.nffga_posts_mirror_first_photo() from public, anon, authenticated;

drop trigger if exists nffga_posts_mirror_first_photo_trg on public.nffga_posts;
create trigger nffga_posts_mirror_first_photo_trg
  before insert or update of photo_paths on public.nffga_posts
  for each row execute function public.nffga_posts_mirror_first_photo();

-- Authors may edit their photos as well as their words (105 granted
-- body, photo_path, deleted_at; nffga_board_edit_guard already limits
-- officers to deleted_at on other people's rows).
grant update (photo_paths) on public.nffga_posts to authenticated;

commit;

-- DONE.
