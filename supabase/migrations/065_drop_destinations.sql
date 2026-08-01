-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 065. Drop destinations.
-- ════════════════════════════════════════════════════════════════════════
-- A DROP is a post. Text, photo, or video. It goes to one of three places:
--
--   PUBLIC   visibility='public'        the open feed
--   CREW     visibility='family'        one crew's feed (unchanged)
--   DM       visibility='direct'        one person, direct_recipient_id
--
-- A drop can also burn. destruct_on_view=true means the drop leaves the
-- feed for a viewer the moment that viewer has seen it. The author keeps
-- seeing their own drop forever.
--
-- A DEADDROP is the same drop with a GPS lock on the payload. It lands in
-- the feed at the chosen destination like any other drop. The physical
-- unlock lives in hunt_caches / claim_hunt_find (migrations 052-054) and
-- is untouched here. This file only opens the destinations.
--
-- WHAT THIS FILE DOES NOT DO. It does not rename anything. post_views
-- already exists from migration 002 keyed (post_id, profile_id), and
-- unread_family_updates_for() reads pv.profile_id by name. profile_id IS
-- the viewer column. Renaming it would break that function at call time,
-- so the column keeps its name and this file uses it as-is.
--
-- Run BY HAND. Idempotent. Atomic. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columns on posts ───────────────────────────────────────────────
-- destruct_on_view: the snap behavior. One look, then gone.
-- direct_recipient_id: set only on a DM drop.

alter table public.posts
  add column if not exists destruct_on_view boolean not null default false;

alter table public.posts
  add column if not exists direct_recipient_id uuid
    references public.profiles(id) on delete cascade;

comment on column public.posts.destruct_on_view is
  'True: this drop disappears for a viewer once that viewer has a post_views row for it. The author always keeps seeing it.';
comment on column public.posts.direct_recipient_id is
  'The one person a visibility=direct drop is addressed to. Null on every other visibility.';


-- ── 2. Visibility check constraint: keep every value, add 'direct' ────
-- The constraint may be named anything (001 created it inline, so it is
-- posts_visibility_check on a stock database, but do not trust that).
-- Find every CHECK constraint whose referenced column set is exactly
-- {visibility}, harvest the literals out of its definition, drop it, then
-- write one constraint holding the union of:
--   the literals already allowed
--   the literals actually present in the table
--   'direct'
-- No allowed value is ever lost, including any added after this file.
do $$
declare
  con       record;
  lit       text;
  vis_attnum smallint;
  vals      text[] := array['public', 'connections', 'family', 'private', 'direct'];
begin
  select a.attnum into vis_attnum
  from pg_attribute a
  where a.attrelid = 'public.posts'::regclass
    and a.attname = 'visibility'
    and not a.attisdropped;

  if vis_attnum is null then
    raise exception 'public.posts has no visibility column';
  end if;

  for con in
    select c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.conrelid = 'public.posts'::regclass
      and c.contype = 'c'
      and c.conkey = array[vis_attnum]::smallint[]
  loop
    for lit in
      select mt[1] from regexp_matches(con.def, '''([^'']+)''', 'g') as t(mt)
    loop
      if lit is not null and not (lit = any (vals)) then
        vals := vals || lit;
      end if;
    end loop;
    execute format('alter table public.posts drop constraint %I', con.conname);
  end loop;

  for lit in
    select distinct p.visibility from public.posts p where p.visibility is not null
  loop
    if not (lit = any (vals)) then
      vals := vals || lit;
    end if;
  end loop;

  alter table public.posts drop constraint if exists posts_visibility_check;

  execute format(
    'alter table public.posts add constraint posts_visibility_check check (visibility = any (array[%s]::text[]))',
    (select string_agg(quote_literal(v), ', ' order by v) from unnest(vals) as v)
  );
end$$;


-- ── 3. A DM drop carries a recipient. Nothing else does. ──────────────
-- Added AFTER the block above on purpose: this constraint references two
-- columns, so its conkey is {visibility, direct_recipient_id} and the
-- harvest loop skips it. Order still matters if the file is edited later.
alter table public.posts
  drop constraint if exists posts_direct_recipient_pairing_check;

alter table public.posts
  add constraint posts_direct_recipient_pairing_check check (
    (visibility = 'direct' and direct_recipient_id is not null)
    or (visibility <> 'direct' and direct_recipient_id is null)
  );


-- ── 4. Indexes ────────────────────────────────────────────────────────
-- Both partial. Burning drops and DMs are a thin slice of the table.
create index if not exists posts_destruct_idx
  on public.posts(destruct_on_view) where destruct_on_view;

create index if not exists posts_direct_recipient_idx
  on public.posts(direct_recipient_id) where direct_recipient_id is not null;


-- ── 5. post_views ─────────────────────────────────────────────────────
-- Already exists from 002. create-if-not-exists keeps a fresh database
-- identical to the live one. profile_id is the viewer.
create table if not exists public.post_views (
  post_id    uuid not null references public.posts(id)    on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (post_id, profile_id)
);

alter table public.post_views enable row level security;

-- Viewer index. profile_id leads, so this serves lookups by viewer alone.
create index if not exists post_views_profile_idx
  on public.post_views(profile_id, viewed_at desc);

-- ── post_views RLS. READ THIS BEFORE CHANGING IT. ─────────────────────
-- The posts SELECT policy below reads post_views. That is not a cycle,
-- and it must never become one. These two policies key on auth.uid()
-- alone. They do not reference posts. They must never reference posts.
-- A post_views policy that reads posts would close the loop and Postgres
-- would raise 42P17 infinite recursion, the same failure letters hit in
-- migration 063.
--
-- Insert and select, own rows, nothing else. No update, no delete: a
-- burned drop stays burned. Mark a view with an insert that ignores
-- duplicates (on conflict do nothing). An upsert would need an UPDATE
-- policy that deliberately does not exist.
drop policy if exists views_self               on public.post_views;
drop policy if exists post_views_select_self   on public.post_views;
drop policy if exists post_views_insert_self   on public.post_views;

create policy post_views_select_self on public.post_views
  for select to authenticated
  using (auth.uid() = profile_id);

create policy post_views_insert_self on public.post_views
  for insert to authenticated
  with check (auth.uid() = profile_id);


-- ── 6. Definer helper: has the caller already seen this drop? ─────────
-- SECURITY DEFINER cuts the cross-table read out of RLS evaluation
-- entirely, so no future post_views policy can ever form a cycle with
-- posts. It answers about the CALLER only. It cannot leak another
-- person's rows because auth.uid() is the only key it accepts.
create or replace function public.uid_has_seen_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.post_views
    where post_id = p_post_id
      and profile_id = auth.uid()
  );
$$;

revoke all on function public.uid_has_seen_post(uuid) from public, anon, authenticated;
grant execute on function public.uid_has_seen_post(uuid) to authenticated;


-- ── 7. posts SELECT. One rule, extended. ──────────────────────────────
-- Carried forward from 019 unchanged: self, public, crew (with the
-- recipient-restricted update list), connections via family_network_reach
-- or an accepted connection. Two additions:
--
--   direct   readable by the author and direct_recipient_id. Nobody else.
--   destruct the burn filter, applied to everyone except the author.
--
-- The author branch sits outside the burn filter, so an author never
-- loses their own drop. destruct_on_view is checked before the helper
-- runs, so a normal drop never pays for the lookup.
drop policy if exists posts_read on public.posts;

create policy posts_read on public.posts
  for select to authenticated using (
    -- Author reads their own, always, burned or not.
    auth.uid() = author_id

    or (
      (
        -- Public: anyone signed in.
        visibility = 'public'

        -- Crew: active member of the post's crew, and on the recipient
        -- list when the update carries one.
        or (visibility = 'family' and family_id is not null and exists (
          select 1 from public.family_members fm
          where fm.family_id = posts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'
        ) and (
          posts.update_recipient_ids is null
          or array_length(posts.update_recipient_ids, 1) is null
          or auth.uid() = any(posts.update_recipient_ids)
        ))

        -- Connections: inside the author's crew network, or an explicit
        -- accepted connection.
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

        -- DM: the one person it was addressed to.
        or (visibility = 'direct' and direct_recipient_id = auth.uid())
      )

      -- The burn. Seen once, gone.
      and not (destruct_on_view and public.uid_has_seen_post(posts.id))
    )
  );

-- post_media_read, comments_read and reactions_read all gate on
-- "exists (select 1 from posts ...)", which re-evaluates this policy.
-- A burned drop takes its photos, comments and hearts with it. No change
-- needed there.


-- ── 8. posts INSERT. A person can always drop on their own platform. ──
-- Replaces the gate from migration 005, which demanded an active crew
-- membership before you could write anything public. That was the
-- family-first product, and it is retired. Crew is a destination now,
-- not a permission.
--
-- The rules this policy states:
--   author_id is always the caller
--   a crew drop names an active membership in that crew
--   a DM drop names a recipient who is not yourself
--   'direct' is allowed at all, which it was not before
--
-- KNOWN, PRE-EXISTING, NOT CHANGED HERE. posts_author_write from 001 is
-- FOR ALL with check (auth.uid() = author_id), and permissive policies
-- OR together. So INSERT already passes on authorship alone and the crew
-- clause below is advisory rather than enforced. That was true of the 005
-- gate too, which is why the broken send was the composer's gate and not
-- this policy. Narrowing posts_author_write to UPDATE and DELETE would
-- make the crew clause bite. It is a separate change with its own blast
-- radius, so it is deliberately not made here.
drop policy if exists posts_insert on public.posts;

create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      visibility in ('public', 'connections', 'private')

      or (
        visibility = 'family'
        and family_id is not null
        and exists (
          select 1 from public.family_members fm
          where fm.family_id = posts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'
        )
      )

      or (
        visibility = 'direct'
        and direct_recipient_id is not null
        and direct_recipient_id <> auth.uid()
      )
    )
  );

-- viewer_has_active_family() from 005 is left in place. Nothing calls it
-- now, but dropping a function other code may reach for is a separate
-- decision from opening the composer.

commit;

-- PostgREST caches the schema. Reload so the new columns and policies
-- are live at once.
notify pgrst, 'reload schema';

-- DONE.
