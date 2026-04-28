-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Family Network Reach + Block List
-- ════════════════════════════════════════════════════════════════════════
--
-- Drop-in SQL for the new collaborator's foundation (their migrations
-- 001_foundation.sql + 002_engagement.sql). Apply AFTER 001/002.
--
-- Provides:
--   1. profile_blocks table — bidirectional block list
--   2. family_network_reach() function — transitive family graph
--   3. Updated posts_read policy using the function
--   4. get_connections_feed() RPC — paginated feed of network posts
--
-- The mental model: joining a family is the act of consent that
-- auto-creates "connections" with everyone in that family AND
-- everyone in any family they belong to, bounded by max_depth hops.
-- No friend requests, no paywall, no hidden network. Block list is
-- the only way to say "no" to someone reachable through the mesh.
--
-- Assumes existing tables from migration 001: profiles, families,
-- family_members (with status='active'), posts (with visibility enum
-- and author_id), connections (optional — for non-family ties).
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. BLOCK LIST ──────────────────────────────────────────────────────
-- Bidirectional: a row blocks visibility BOTH ways. Either party can
-- create the row; nobody but the creator can read it (so blocked users
-- can't tell they've been blocked).
create table public.profile_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index profile_blocks_blocker_idx on public.profile_blocks(blocker_id);
create index profile_blocks_blocked_idx on public.profile_blocks(blocked_id);

alter table public.profile_blocks enable row level security;

create policy blocks_self_read on public.profile_blocks
  for select to authenticated using (auth.uid() = blocker_id);

create policy blocks_self_write on public.profile_blocks
  for all to authenticated
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- Helper: is there ANY block between two profiles in either direction?
create or replace function public.are_blocked(a uuid, b uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;


-- ── 2. FAMILY NETWORK REACH ────────────────────────────────────────────
-- Returns every profile reachable from `viewer` through ≤ max_depth hops
-- of active family membership. Hops = 0 is the viewer themselves.
--
-- max_depth defaults to 3:
--   0 = self
--   1 = direct family co-members
--   2 = co-members of those co-members' other families
--   3 = one more hop out
--
-- We exclude blocked profiles from the result so a single function
-- call gives the safe network. Caller doesn't need to filter again.
create or replace function public.family_network_reach(
  viewer uuid,
  max_depth int default 3
)
returns table (profile_id uuid, hops int)
language sql stable security invoker
set search_path = public
as $$
  with recursive mesh as (
    -- Seed: the viewer at hop 0
    select viewer as profile_id, 0 as hops

    union

    -- Step: anyone sharing an active family with someone in the mesh
    select fm_other.profile_id, m.hops + 1
    from mesh m
    join public.family_members fm_self
      on fm_self.profile_id = m.profile_id
     and fm_self.status = 'active'
    join public.family_members fm_other
      on fm_other.family_id = fm_self.family_id
     and fm_other.status = 'active'
     and fm_other.profile_id <> m.profile_id
    where m.hops < max_depth
  )
  select
    mesh.profile_id,
    min(mesh.hops) as hops
  from mesh
  where not public.are_blocked(viewer, mesh.profile_id)
  group by mesh.profile_id;
$$;

comment on function public.family_network_reach(uuid, int) is
  'Returns the set of profile_ids reachable from `viewer` through up to '
  '`max_depth` hops of active family membership. Blocked profiles are '
  'excluded. The viewer themselves is included at hop 0.';


-- ── 3. UPDATED POST VISIBILITY POLICY ──────────────────────────────────
-- Replaces the connections branch in 001's posts_read policy with the
-- family-network-reach lookup, while keeping the optional explicit
-- connections table as a secondary path for non-family ties.
drop policy if exists posts_read on public.posts;

create policy posts_read on public.posts
  for select to authenticated using (
    -- Self-read: always
    auth.uid() = author_id

    -- Public posts: anyone signed in
    or visibility = 'public'

    -- Family-scoped: must be active member of the post's family
    or (visibility = 'family' and family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = posts.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    ))

    -- Connections-scoped: viewer is in the author's family network OR
    -- has an explicit accepted connection.
    or (visibility = 'connections' and (
      author_id in (
        select profile_id from public.family_network_reach(auth.uid(), 3)
      )
      or exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.requester_id = auth.uid() and c.recipient_id = posts.author_id)
            or (c.recipient_id = auth.uid() and c.requester_id = posts.author_id))
      )
    ))
  );


-- ── 4. CONNECTIONS FEED RPC ────────────────────────────────────────────
-- Family-network feed, paginated, with closer-hop posts surfaced first.
-- Mirrors get_home_feed from migration 002 but scoped to the network.
create or replace function public.get_connections_feed(
  page_size int default 20,
  before_time timestamptz default null
)
returns table (
  post_id uuid,
  author_id uuid,
  body text,
  family_id uuid,
  visibility text,
  heart_count int,
  boost_count int,
  comment_count int,
  created_at timestamptz,
  hops int
)
language sql stable security invoker
set search_path = public
as $$
  with viewer_network as (
    select profile_id, hops from public.family_network_reach(auth.uid(), 3)
  )
  select
    p.id as post_id,
    p.author_id,
    p.body,
    p.family_id,
    p.visibility,
    p.heart_count,
    p.boost_count,
    p.comment_count,
    p.created_at,
    vn.hops
  from public.posts p
  join viewer_network vn on vn.profile_id = p.author_id
  where (before_time is null or p.created_at < before_time)
    and (
      -- Public + connections-visible posts authored by anyone in the network
      p.visibility in ('public', 'connections')
      -- OR family-scoped posts from a family the viewer is in
      or (p.visibility = 'family' and p.family_id is not null and exists (
        select 1 from public.family_members fm
        where fm.family_id = p.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      ))
    )
  order by
    vn.hops asc,           -- closer hops first (your immediate family > 3-hops-out)
    p.created_at desc      -- then newest within each hop band
  limit page_size;
$$;

grant execute on function public.family_network_reach(uuid, int) to authenticated;
grant execute on function public.get_connections_feed(int, timestamptz) to authenticated;


-- ── 5. NETWORK STATS HELPER (for profile page + landing) ───────────────
-- "X people in your network · Y families connected"
create or replace function public.my_network_stats()
returns table (
  reachable_profiles int,
  reachable_families int,
  direct_family_count int
)
language sql stable security invoker
set search_path = public
as $$
  with reach as (
    select profile_id from public.family_network_reach(auth.uid(), 3)
  ),
  families_in_reach as (
    select distinct fm.family_id
    from public.family_members fm
    join reach r on r.profile_id = fm.profile_id
    where fm.status = 'active'
  )
  select
    (select count(*)::int from reach) as reachable_profiles,
    (select count(*)::int from families_in_reach) as reachable_families,
    (select count(*)::int from public.family_members
       where profile_id = auth.uid() and status = 'active') as direct_family_count;
$$;

grant execute on function public.my_network_stats() to authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- USAGE NOTES FOR THE FRONTEND
-- ════════════════════════════════════════════════════════════════════════
--
-- 1. Default post visibility for the public feed composer: 'public'.
-- 2. Default for the family page composer: 'family' with that family_id.
-- 3. Add a "Connections" toggle in the public composer that switches
--    visibility from 'public' to 'connections' — uses the family network.
-- 4. The "Connections" feed tab calls get_connections_feed() and
--    paginates via the before_time cursor.
-- 5. Profile page calls my_network_stats() once on mount.
-- 6. Block flow: insert into profile_blocks; the function automatically
--    excludes both directions on next query.
--
-- PERFORMANCE NOTES
--   - The recursive CTE is cheap up to ~5000 reachable profiles.
--   - If profiling shows degradation, add a materialized view that
--     refreshes hourly: CREATE MATERIALIZED VIEW family_reach_cache AS …
--   - Don't over-optimize until measured. Postgres is fast.
--
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
