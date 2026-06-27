-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 052: Photo geocache hunt
-- ════════════════════════════════════════════════════════════════════════
-- Merges the GPS Wayfinder with the photo-capture game. A "cache" is a
-- photograph dropped at a GPS coordinate. A hider drops it (photo +
-- lat/lng); a seeker navigates by compass/distance and logs a find,
-- optionally with their own proof photo. Everything persists here so
-- caches are durable and shareable, not just a code in a URL hash.
--
-- Access is forward-compatible: caches carry a scope (public / family /
-- link) and a short share_code; creator_id and finder_id are nullable
-- so anonymous play can be added later without a rewrite. The find
-- gate (within radius, 25m GPS-noise forgiveness) is enforced server-
-- side in claim_hunt_find(), not trusted from the client.
--
-- Storage: bucket `hunt-photos` (public read — the clue photo is meant
-- to be seen during the hunt). Path convention:
--   {cache_id}/clue.{ext}        the hider's cache photo
--   {cache_id}/find-{uid}.{ext}  a seeker's proof photo
-- ════════════════════════════════════════════════════════════════════════

-- ── Tables ───────────────────────────────────────────────────────────

create table if not exists public.hunt_caches (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid references public.profiles(id) on delete set null,
  title         text,
  hint          text,
  lat           double precision not null,
  lng           double precision not null,
  accuracy_m    double precision,
  radius_m      integer not null default 25,
  photo_path    text,
  scope         text not null default 'link'
                check (scope in ('public', 'family', 'link')),
  family_id     uuid references public.families(id) on delete cascade,
  share_code    text unique,
  active        boolean not null default true,
  found_count   integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists hunt_caches_creator_idx on public.hunt_caches(creator_id);
create index if not exists hunt_caches_code_idx     on public.hunt_caches(share_code);
create index if not exists hunt_caches_public_idx    on public.hunt_caches(scope) where active;

create table if not exists public.hunt_finds (
  id                uuid primary key default gen_random_uuid(),
  cache_id          uuid not null references public.hunt_caches(id) on delete cascade,
  finder_id         uuid references public.profiles(id) on delete set null,
  proof_photo_path  text,
  distance_m        double precision,
  found_at          timestamptz not null default now(),
  unique (cache_id, finder_id)
);

create index if not exists hunt_finds_cache_idx on public.hunt_finds(cache_id);

-- ── Share code: 8-char A–Z2–9 (no ambiguous chars), unique ───────────

create or replace function public.gen_hunt_code()
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.hunt_caches where share_code = code);
  end loop;
  return code;
end; $$;

create or replace function public.hunt_caches_set_code()
returns trigger language plpgsql as $$
begin
  if new.share_code is null then
    new.share_code := public.gen_hunt_code();
  end if;
  return new;
end; $$;

drop trigger if exists hunt_caches_code_trg on public.hunt_caches;
create trigger hunt_caches_code_trg
  before insert on public.hunt_caches
  for each row execute function public.hunt_caches_set_code();

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.hunt_caches enable row level security;
alter table public.hunt_finds  enable row level security;

-- Caches: read public ones, your own, or family-scoped ones you belong
-- to. Link-scoped caches are reached via find_hunt_by_code() (anon RPC),
-- not direct select, so they stay unlisted.
drop policy if exists hunt_caches_read on public.hunt_caches;
create policy hunt_caches_read on public.hunt_caches
  for select to authenticated
  using (
    (scope = 'public' and active)
    or creator_id = auth.uid()
    or (
      scope = 'family' and exists (
        select 1 from public.family_members fm
        where fm.family_id = hunt_caches.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )
  );

drop policy if exists hunt_caches_insert on public.hunt_caches;
create policy hunt_caches_insert on public.hunt_caches
  for insert to authenticated
  with check (creator_id = auth.uid());

drop policy if exists hunt_caches_update on public.hunt_caches;
create policy hunt_caches_update on public.hunt_caches
  for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists hunt_caches_delete on public.hunt_caches;
create policy hunt_caches_delete on public.hunt_caches
  for delete to authenticated
  using (creator_id = auth.uid());

-- Finds: visible to the finder and to the cache's creator. Inserts go
-- through claim_hunt_find() (SECURITY DEFINER), which enforces the GPS
-- gate, so there is deliberately no direct insert policy.
drop policy if exists hunt_finds_read on public.hunt_finds;
create policy hunt_finds_read on public.hunt_finds
  for select to authenticated
  using (
    finder_id = auth.uid()
    or exists (
      select 1 from public.hunt_caches c
      where c.id = hunt_finds.cache_id and c.creator_id = auth.uid()
    )
  );

-- ── Anon-callable lookup by share code ───────────────────────────────
-- Lets a /hunt/<code> link resolve for a not-yet-signed-in visitor,
-- mirroring find_family_by_invite_code. Returns only what the seek
-- screen needs.
create or replace function public.find_hunt_by_code(p_code text)
returns table (
  id uuid, title text, hint text, lat double precision, lng double precision,
  radius_m integer, photo_path text, found_count integer, creator_id uuid
)
language sql security definer set search_path = public as $$
  select id, title, hint, lat, lng, radius_m, photo_path, found_count, creator_id
  from public.hunt_caches
  where share_code = upper(p_code) and active
  limit 1;
$$;

grant execute on function public.find_hunt_by_code(text) to anon, authenticated;

-- ── The find gate ────────────────────────────────────────────────────
-- Haversine in metres, 25m forgiveness over the cache radius. Idempotent
-- per (cache, finder): re-finding updates the proof + distance.
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

-- ── Storage bucket: hunt-photos (public read) ────────────────────────

insert into storage.buckets (id, name, public)
values ('hunt-photos', 'hunt-photos', true)
on conflict (id) do nothing;

-- Authenticated users may upload and remove hunt photos. Read is public
-- (the bucket's public flag serves clue photos during the hunt).
drop policy if exists hunt_photos_insert on storage.objects;
create policy hunt_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hunt-photos');

drop policy if exists hunt_photos_delete on storage.objects;
create policy hunt_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'hunt-photos');

-- DONE.
