-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 054: chained deaddrops
-- ════════════════════════════════════════════════════════════════════════
-- A drop can require that the seeker has already FOUND another drop. Set
-- prerequisite_cache_id to chain them: you cannot reach #2 until you have
-- collected #1. The lock is enforced three ways:
--   - claim_hunt_find refuses a find while the prerequisite is unmet.
--   - find_hunt_by_code reports `locked` and withholds the coordinates,
--     hint, and photo so a locked seeker cannot navigate ahead.
-- ════════════════════════════════════════════════════════════════════════

alter table public.hunt_caches
  add column if not exists prerequisite_cache_id uuid
    references public.hunt_caches(id) on delete set null;

-- ── Resolver: now returns `locked` and hides the payload when locked ──
drop function if exists public.find_hunt_by_code(text);

create function public.find_hunt_by_code(p_code text)
returns table (
  id uuid, title text, hint text, lat double precision, lng double precision,
  radius_m integer, photo_path text, found_count integer, creator_id uuid,
  self_destruct boolean, locked boolean
)
language sql security definer set search_path = public as $$
  with hit as (
    select *,
      (prerequisite_cache_id is not null
        and not exists (
          select 1 from public.hunt_finds f
          where f.cache_id = hunt_caches.prerequisite_cache_id
            and f.finder_id = auth.uid()
        )
      ) as is_locked
    from public.hunt_caches
    where share_code = upper(p_code) and active
    limit 1
  )
  select
    id, title,
    case when is_locked then null else hint end,
    case when is_locked then null else lat end,
    case when is_locked then null else lng end,
    radius_m,
    case when is_locked then null else photo_path end,
    found_count, creator_id, self_destruct, is_locked
  from hit;
$$;

grant execute on function public.find_hunt_by_code(text) to anon, authenticated;

-- ── Find gate: refuse while the prerequisite is unmet ────────────────
create or replace function public.claim_hunt_find(
  p_cache_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_proof_path text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.hunt_caches;
  dist double precision;
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  select * into c from public.hunt_caches where id = p_cache_id and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if c.prerequisite_cache_id is not null and not exists (
    select 1 from public.hunt_finds f
    where f.cache_id = c.prerequisite_cache_id and f.finder_id = uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  dist := 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat - c.lat) / 2), 2) +
    cos(radians(c.lat)) * cos(radians(p_lat)) *
    power(sin(radians(p_lng - c.lng) / 2), 2)
  ));

  if dist > c.radius_m + 25 then
    return jsonb_build_object('ok', false, 'error', 'too_far', 'distance_m', round(dist));
  end if;

  insert into public.hunt_finds (cache_id, finder_id, proof_photo_path, distance_m)
    values (p_cache_id, uid, p_proof_path, dist)
  on conflict (cache_id, finder_id) do update
    set proof_photo_path = coalesce(excluded.proof_photo_path, hunt_finds.proof_photo_path),
        distance_m = excluded.distance_m,
        found_at = now();

  update public.hunt_caches
    set found_count = (select count(*) from public.hunt_finds where cache_id = p_cache_id)
    where id = p_cache_id;

  return jsonb_build_object('ok', true, 'distance_m', round(dist));
end; $$;

grant execute on function public.claim_hunt_find(uuid, double precision, double precision, text) to authenticated;

-- DONE.
