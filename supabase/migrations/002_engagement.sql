-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 002: Engagement & Feed
-- ════════════════════════════════════════════════════════════════════════
-- Adds: hearts, boosts (user-picks-scope), comments, view tracking,
--       denormalized counters, family-aware feed views.
-- Run AFTER 001_foundation.sql.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. POST REACTIONS (hearts) ─────────────────────────────────────────
create table public.post_reactions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null default 'heart' check (reaction_type in ('heart')),
  created_at    timestamptz not null default now(),
  unique (post_id, profile_id, reaction_type)
);
create index post_reactions_post_idx    on public.post_reactions(post_id);
create index post_reactions_profile_idx on public.post_reactions(profile_id, created_at desc);

-- ── 2. POST BOOSTS (caller-chosen scope) ───────────────────────────────
create table public.post_boosts (
  id                uuid primary key default gen_random_uuid(),
  original_post_id  uuid not null references public.posts(id) on delete cascade,
  booster_id        uuid not null references public.profiles(id) on delete cascade,
  scope             text not null check (scope in ('public', 'connections', 'family')),
  family_id         uuid references public.families(id) on delete cascade,
  caption           text,
  created_at        timestamptz not null default now(),
  unique (original_post_id, booster_id, scope, family_id),
  check ((scope = 'family' and family_id is not null)
      or (scope <> 'family' and family_id is null))
);
create index post_boosts_original_idx on public.post_boosts(original_post_id);
create index post_boosts_booster_idx  on public.post_boosts(booster_id, created_at desc);
create index post_boosts_family_idx   on public.post_boosts(family_id, created_at desc);

-- ── 3. COMMENTS (single-level threading) ───────────────────────────────
create table public.comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  author_id         uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body              text not null check (length(body) between 1 and 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create index comments_post_idx   on public.comments(post_id, created_at);
create index comments_parent_idx on public.comments(parent_comment_id);

create or replace function public.enforce_comment_depth()
returns trigger language plpgsql as $$
declare
  parent_parent uuid;
begin
  if new.parent_comment_id is not null then
    select parent_comment_id into parent_parent
      from public.comments where id = new.parent_comment_id;
    if parent_parent is not null then
      raise exception 'Comments may only nest one level deep';
    end if;
  end if;
  return new;
end$$;
create trigger comments_enforce_depth before insert on public.comments
  for each row execute function public.enforce_comment_depth();

-- ── 4. POST VIEWS ──────────────────────────────────────────────────────
create table public.post_views (
  post_id    uuid not null references public.posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create index post_views_profile_idx on public.post_views(profile_id, viewed_at desc);

-- ── 5. DENORMALIZED COUNTERS ON posts ──────────────────────────────────
alter table public.posts
  add column heart_count   int not null default 0,
  add column boost_count   int not null default 0,
  add column comment_count int not null default 0;

create or replace function public.bump_heart_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set heart_count = heart_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set heart_count = greatest(heart_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end$$;
create trigger reactions_count_ins after insert on public.post_reactions
  for each row execute function public.bump_heart_count();
create trigger reactions_count_del after delete on public.post_reactions
  for each row execute function public.bump_heart_count();

create or replace function public.bump_boost_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set boost_count = boost_count + 1 where id = new.original_post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set boost_count = greatest(boost_count - 1, 0) where id = old.original_post_id;
  end if;
  return null;
end$$;
create trigger boosts_count_ins after insert on public.post_boosts
  for each row execute function public.bump_boost_count();
create trigger boosts_count_del after delete on public.post_boosts
  for each row execute function public.bump_boost_count();

create or replace function public.bump_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end$$;
create trigger comments_count_ins after insert on public.comments
  for each row execute function public.bump_comment_count();
create trigger comments_count_del after delete on public.comments
  for each row execute function public.bump_comment_count();

-- ── 6. RLS ─────────────────────────────────────────────────────────────
alter table public.post_reactions enable row level security;
alter table public.post_boosts    enable row level security;
alter table public.comments       enable row level security;
alter table public.post_views     enable row level security;

create policy reactions_read on public.post_reactions
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );
create policy reactions_self on public.post_reactions
  for all to authenticated using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy boosts_read on public.post_boosts
  for select to authenticated using (
    scope = 'public'
    or auth.uid() = booster_id
    or (scope = 'connections' and exists (
          select 1 from public.connections c
          where c.status = 'accepted'
            and ((c.requester_id = auth.uid() and c.recipient_id = post_boosts.booster_id)
              or (c.recipient_id = auth.uid() and c.requester_id = post_boosts.booster_id))))
    or (scope = 'family' and exists (
          select 1 from public.family_members fm
          where fm.family_id = post_boosts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'))
  );
create policy boosts_self on public.post_boosts
  for all to authenticated using (auth.uid() = booster_id)
  with check (auth.uid() = booster_id);

create policy comments_read on public.comments
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = comments.post_id)
  );
create policy comments_self on public.comments
  for all to authenticated using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy views_self on public.post_views
  for all to authenticated using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ── 7. FEED ITEM VIEW ──────────────────────────────────────────────────
create or replace view public.feed_items as
  select
    'post'::text          as item_type,
    p.id                  as item_id,
    p.id                  as post_id,
    p.author_id           as actor_id,
    p.author_id           as original_author_id,
    null::uuid            as boost_id,
    null::text            as boost_caption,
    p.visibility          as scope,
    p.family_id           as scope_family_id,
    p.created_at          as feed_time,
    p.heart_count,
    p.boost_count,
    p.comment_count
  from public.posts p
  union all
  select
    'boost'::text         as item_type,
    b.id                  as item_id,
    b.original_post_id    as post_id,
    b.booster_id          as actor_id,
    p.author_id           as original_author_id,
    b.id                  as boost_id,
    b.caption             as boost_caption,
    b.scope,
    b.family_id           as scope_family_id,
    b.created_at          as feed_time,
    p.heart_count,
    p.boost_count,
    p.comment_count
  from public.post_boosts b
  join public.posts p on p.id = b.original_post_id;

create or replace function public.family_weight(viewer uuid, target_author uuid)
returns int language sql stable as $$
  select case when exists (
    select 1
    from public.family_members fm1
    join public.family_members fm2 on fm1.family_id = fm2.family_id
    where fm1.profile_id = viewer
      and fm2.profile_id = target_author
      and fm1.status = 'active'
      and fm2.status = 'active'
  ) then 2 else 0 end
$$;

-- ── 8. RPC: get_home_feed ──────────────────────────────────────────────
create or replace function public.get_home_feed(
  page_size int default 20,
  before_time timestamptz default null
)
returns table (
  item_type text,
  item_id uuid,
  post_id uuid,
  actor_id uuid,
  original_author_id uuid,
  boost_id uuid,
  boost_caption text,
  feed_time timestamptz,
  heart_count int,
  boost_count int,
  comment_count int,
  family_score int
)
language sql stable security invoker as $$
  with viewer as (select auth.uid() as uid)
  select
    fi.item_type, fi.item_id, fi.post_id, fi.actor_id, fi.original_author_id,
    fi.boost_id, fi.boost_caption, fi.feed_time,
    fi.heart_count, fi.boost_count, fi.comment_count,
    public.family_weight((select uid from viewer), fi.original_author_id) as family_score
  from public.feed_items fi
  where (before_time is null or fi.feed_time < before_time)
    and (
      fi.scope = 'public'
      or fi.actor_id = (select uid from viewer)
      or (fi.scope = 'connections' and exists (
          select 1 from public.connections c
          where c.status = 'accepted'
            and ((c.requester_id = (select uid from viewer) and c.recipient_id = fi.actor_id)
              or (c.recipient_id = (select uid from viewer) and c.requester_id = fi.actor_id))))
      or (fi.scope = 'family' and fi.scope_family_id is not null and exists (
          select 1 from public.family_members fm
          where fm.family_id = fi.scope_family_id
            and fm.profile_id = (select uid from viewer)
            and fm.status = 'active'))
    )
  order by family_score desc, fi.feed_time desc
  limit page_size
$$;

grant execute on function public.get_home_feed(int, timestamptz) to authenticated;
