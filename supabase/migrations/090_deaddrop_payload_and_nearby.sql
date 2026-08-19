-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 090: the sealed payload, and finding drops nearby
-- ════════════════════════════════════════════════════════════════════════
-- Deaddrop grows into its own sentence: get outside, leave a photo at a
-- fixed set of coordinates, and the payload stays shut until someone
-- stands on it.
--
-- Two instruments:
--
--   1. THE PAYLOAD. A photo the hider leaves AT the spot. Unlike the
--      clue photo (public by design — it is shown during the hunt), the
--      payload lives in a PRIVATE bucket and is readable by exactly two
--      parties: the hider, and anyone with a hunt_finds row — which
--      only claim_hunt_find writes, and only inside the GPS gate.
--      Standing on the spot IS the key. Uploads go through the
--      hunt-upload function (service role), so no INSERT policy exists
--      here at all: the read policy is the entire client surface.
--
--   2. NEARBY. Search for drops around you by mileage radius. Public
--      drops for anyone; cohort drops for their members. Link-scope
--      drops never surface — a link is an invitation, not a listing.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The payload column ────────────────────────────────────────────

alter table public.hunt_caches add column if not exists payload_photo_path text;

-- ── 2. The private bucket and its read gate ──────────────────────────

insert into storage.buckets (id, name, public)
values ('hunt-payloads', 'hunt-payloads', false)
on conflict (id) do nothing;

-- Readable by the hider, or by someone who has stood on the spot.
-- Object names are <cache_id>/payload.<ext>; the folder name is the
-- join key.
drop policy if exists hunt_payloads_read on storage.objects;
create policy hunt_payloads_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hunt-payloads'
    and (
      exists (
        select 1 from public.hunt_caches c
        where c.id::text = split_part(storage.objects.name, '/', 1)
          and c.creator_id = auth.uid()
      )
      or exists (
        select 1 from public.hunt_finds f
        where f.cache_id::text = split_part(storage.objects.name, '/', 1)
          and f.finder_id = auth.uid()
      )
    )
  );

-- No INSERT / UPDATE / DELETE policies on purpose. Writes ride the
-- hunt-upload function's service role, which verifies the uploader owns
-- the cache. A policy here would be a second, laxer door.

-- ── 3. find_hunt_by_code learns about the payload ────────────────────
-- The PATH is not the payload: knowing it unlocks nothing (the bucket
-- is private and the read policy above is the gate). Returning it lets
-- the hunt screen say "there is something here" and fetch it the moment
-- the find is claimed.

drop function if exists public.find_hunt_by_code(text);
create function public.find_hunt_by_code(p_code text)
returns table (
  id uuid, title text, hint text, lat double precision, lng double precision,
  radius_m integer, photo_path text, found_count integer, creator_id uuid,
  payload_photo_path text, creator_name text, creator_handle text
)
language sql security definer set search_path = public as $$
  select c.id, c.title, c.hint, c.lat, c.lng, c.radius_m, c.photo_path,
         c.found_count, c.creator_id, c.payload_photo_path,
         p.display_name, p.handle
  from public.hunt_caches c
  left join public.profiles p on p.id = c.creator_id
  where c.share_code = upper(p_code) and c.active
  limit 1;
$$;

grant execute on function public.find_hunt_by_code(text) to anon, authenticated;

-- ── 4. Nearby ────────────────────────────────────────────────────────
-- Haversine in miles, capped radius, capped rows. Definer so the scope
-- rules live here rather than in whatever RLS happens to say; members
-- only — a location search is a member's instrument, not an anon one.

create or replace function public.nearby_hunt_caches(
  p_lat double precision,
  p_lng double precision,
  p_radius_miles double precision default 5
)
returns table (
  id uuid, title text, hint text, lat double precision, lng double precision,
  radius_m integer, share_code text, found_count integer,
  has_payload boolean, distance_miles double precision,
  creator_name text, creator_handle text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  scoped as (
    select c.*
    from public.hunt_caches c, me
    where c.active
      and (
        c.scope = 'public'
        or (
          c.scope = 'family'
          and exists (
            select 1 from public.family_members fm
            where fm.family_id = c.family_id
              and fm.profile_id = me.uid
              and fm.status = 'active'
          )
        )
      )
  ),
  measured as (
    select s.*,
      (2 * 3958.8 * asin(sqrt(
        power(sin(radians(p_lat - s.lat) / 2), 2) +
        cos(radians(s.lat)) * cos(radians(p_lat)) *
        power(sin(radians(p_lng - s.lng) / 2), 2)
      ))) as distance_miles
    from scoped s
  )
  -- Who left it rides along. A deaddrop is signed work — the feed card
  -- already carries the hider's name, so the search hides nothing the
  -- card does not.
  select m.id, m.title, m.hint, m.lat, m.lng, m.radius_m, m.share_code,
         m.found_count, (m.payload_photo_path is not null) as has_payload,
         m.distance_miles, p.display_name as creator_name, p.handle as creator_handle
  from measured m
  left join public.profiles p on p.id = m.creator_id
  where auth.uid() is not null
    and m.distance_miles <= least(greatest(p_radius_miles, 0.1), 100)
  order by m.distance_miles
  limit 50;
$$;

revoke all on function public.nearby_hunt_caches(double precision, double precision, double precision) from public, anon;
grant execute on function public.nearby_hunt_caches(double precision, double precision, double precision) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   select * from nearby_hunt_caches(41.82, -71.41, 25);  → rows w/ miles
--   (as a non-finder) select from storage: hunt-payloads object → denied
--   (after claim_hunt_find succeeds) same object → allowed
-- DONE.
