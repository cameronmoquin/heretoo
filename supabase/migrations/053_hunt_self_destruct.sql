-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 053: self-destructing deaddrops
-- ════════════════════════════════════════════════════════════════════════
-- A drop can be marked self_destruct. When the finder reveals it on the
-- find, the payload glitches out and the drop is burned: the cache goes
-- inactive and the photo object is deleted (server-side, via the
-- /api/hunt-burn function using the service role).
--
-- find_hunt_by_code now also returns self_destruct so the seek screen
-- knows to run the burn. Changing the function's return columns means
-- dropping and recreating it.
-- ════════════════════════════════════════════════════════════════════════

alter table public.hunt_caches
  add column if not exists self_destruct boolean not null default false;

drop function if exists public.find_hunt_by_code(text);

create function public.find_hunt_by_code(p_code text)
returns table (
  id uuid, title text, hint text, lat double precision, lng double precision,
  radius_m integer, photo_path text, found_count integer, creator_id uuid,
  self_destruct boolean
)
language sql security definer set search_path = public as $$
  select id, title, hint, lat, lng, radius_m, photo_path, found_count,
         creator_id, self_destruct
  from public.hunt_caches
  where share_code = upper(p_code) and active
  limit 1;
$$;

grant execute on function public.find_hunt_by_code(text) to anon, authenticated;

-- DONE.
