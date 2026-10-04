-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 105: Members, the clubhouse board, direct messages
-- ════════════════════════════════════════════════════════════════════════
-- PROFILES. One nffga_profiles row per member, keyed to auth.users. This
-- is NFFGA's own table: EMSPCR's public.profiles is not touched, read or
-- referenced. A signed-in client calls nffga_ensure_profile() right
-- after sign-up (or any time) to get its row, created on first call.
-- Profiles are public — anyone who scans the QR code can read them.
--
-- THE BOARD. nffga_posts and nffga_comments. Anyone (anon included)
-- reads what is not deleted. A signed-in, non-guest member who HAS a
-- profile may post and comment as themselves. A post may be photo-only
-- (empty body). Only NFFGA officers (migration 102) may post kind =
-- 'announcement'. Nothing is hard-deleted from the client: the author
-- or an officer sets deleted_at. Authors may also edit body/photo_path;
-- officers may only delete others' rows; author, kind and created_at
-- never change (column grants + nffga_board_edit_guard). Authors and
-- officers can still read soft-deleted rows — Postgres needs the
-- updated row to stay visible to the person deleting it — so clients
-- listing the board should filter deleted_at is null; for anon and
-- other members RLS already hides them.
--
-- MESSAGES. nffga_threads / nffga_thread_members / nffga_messages. A
-- thread is optionally about a gear listing. Only members of a thread
-- can read or write anything in it; never anon. Threads are created
-- only by nffga_start_thread(), which reuses an existing two-person
-- thread about the same listing (or about no listing).
--
-- GUESTS (JWT is_anonymous = true) never post, comment or message.
--
-- SHARED DATABASE. Project avepftawrkwytlohobjh (EMSPCR) also serves
-- EMSPCR and Car56. Everything here is prefixed nffga_, refers to
-- auth.users directly, and `create or replace`s only functions named
-- nffga_*. The one shared object it touches is Supabase's standard
-- supabase_realtime publication, to which it ADDS nffga_messages (and
-- nothing else; guarded so a re-run is a no-op). Depends on: 102
-- (is_nffga_officer), 103 (nffga_is_guest, nffga_gear_listings).
--
-- Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Preconditions ─────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.is_nffga_officer(uuid)') is null then
    raise exception 'public.is_nffga_officer(uuid) missing: migration 102 has not run here.';
  end if;
  if to_regprocedure('public.nffga_is_guest()') is null
     or to_regclass('public.nffga_gear_listings') is null then
    raise exception 'nffga_is_guest / nffga_gear_listings missing: migration 103 has not run here.';
  end if;
end$$;

-- Same body as 103's; restated so this file stands on its own.
create or replace function public.nffga_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.nffga_touch_updated_at() from public, anon, authenticated;


-- ── 1. Profiles ──────────────────────────────────────────────────────

create table if not exists public.nffga_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60
                                    and btrim(display_name) <> ''),
  department   text check (char_length(department) <= 120),
  rank_title   text check (char_length(rank_title) <= 80),
  city         text check (char_length(city) <= 80),
  state        text check (char_length(state) <= 40),
  handicap     numeric(4,1),
  bio          text check (char_length(bio) <= 1000),
  avatar_path  text,                       -- bucket nffga-media, {user_id}/...
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists nffga_profiles_updated_at on public.nffga_profiles;
create trigger nffga_profiles_updated_at before update on public.nffga_profiles
  for each row execute function public.nffga_touch_updated_at();


-- ── 2. The board ─────────────────────────────────────────────────────

create table if not exists public.nffga_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  -- May be empty for a photo-only post.
  body        text not null default '',
  photo_path  text,                        -- bucket nffga-media, {author_id}/posts/<uuid>.jpg
  kind        text not null default 'post' check (kind in ('post', 'announcement')),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint nffga_posts_body_or_photo check (
    char_length(body) <= 4000
    and (char_length(btrim(body)) >= 1 or photo_path is not null)
  )
);
create index if not exists nffga_posts_feed_idx   on public.nffga_posts(created_at desc) where deleted_at is null;
create index if not exists nffga_posts_author_idx on public.nffga_posts(author_id);

create table if not exists public.nffga_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.nffga_posts(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000 and btrim(body) <> ''),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists nffga_comments_post_idx   on public.nffga_comments(post_id, created_at);
create index if not exists nffga_comments_author_idx on public.nffga_comments(author_id);

-- What a client may change on a post or comment. Applies to direct
-- client writes only (current_user = 'authenticated'); SECURITY INVOKER
-- on purpose so the SECURITY DEFINER delete RPCs pass as their owner.
--   * id, author_id, post_id, kind, created_at: never.
--   * the author: body, photo_path (posts), deleted_at.
--   * an officer moderating someone else's row: deleted_at only.
--   * a deleted row stays deleted.
create or replace function public.nffga_board_edit_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if n->'id' is distinct from o->'id'
     or n->'author_id' is distinct from o->'author_id'
     or n->'post_id' is distinct from o->'post_id'
     or n->'kind' is distinct from o->'kind'
     or n->'created_at' is distinct from o->'created_at' then
    raise exception 'author, kind, post and created_at cannot be changed' using errcode = '42501';
  end if;
  if o->>'deleted_at' is not null and n->>'deleted_at' is null then
    raise exception 'a deleted % cannot be restored', tg_table_name using errcode = '42501';
  end if;
  if (o->>'author_id')::uuid is distinct from auth.uid()
     and ((n - 'deleted_at') is distinct from (o - 'deleted_at')) then
    raise exception 'only the author may edit; moderators may only delete' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function public.nffga_board_edit_guard() from public, anon, authenticated;

drop trigger if exists nffga_posts_edit_guard_trg on public.nffga_posts;
create trigger nffga_posts_edit_guard_trg
  before update on public.nffga_posts
  for each row execute function public.nffga_board_edit_guard();

drop trigger if exists nffga_comments_edit_guard_trg on public.nffga_comments;
create trigger nffga_comments_edit_guard_trg
  before update on public.nffga_comments
  for each row execute function public.nffga_board_edit_guard();


-- ── 3. Direct messages ───────────────────────────────────────────────

create table if not exists public.nffga_threads (
  id               uuid primary key default gen_random_uuid(),
  subject          text check (char_length(subject) <= 200),
  gear_listing_id  uuid references public.nffga_gear_listings(id) on delete set null,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);
create index if not exists nffga_threads_listing_idx on public.nffga_threads(gear_listing_id) where gear_listing_id is not null;

create table if not exists public.nffga_thread_members (
  thread_id    uuid not null references public.nffga_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);
create index if not exists nffga_thread_members_user_idx on public.nffga_thread_members(user_id);

create table if not exists public.nffga_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.nffga_threads(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000 and btrim(body) <> ''),
  created_at  timestamptz not null default now()
);
create index if not exists nffga_messages_thread_idx on public.nffga_messages(thread_id, created_at);

-- A new message bumps its thread to the top of both inboxes.
create or replace function public.nffga_messages_bump_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.nffga_threads
     set last_message_at = greatest(last_message_at, new.created_at)
   where id = new.thread_id;
  return new;
end; $$;
revoke all on function public.nffga_messages_bump_thread() from public, anon, authenticated;
drop trigger if exists nffga_messages_bump_thread_trg on public.nffga_messages;
create trigger nffga_messages_bump_thread_trg
  after insert on public.nffga_messages
  for each row execute function public.nffga_messages_bump_thread();

-- Membership test for the policies. SECURITY DEFINER so the members
-- table's own policy can ask about the members table without recursing.
create or replace function public.nffga_is_thread_member(p_thread_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.nffga_thread_members m
    where m.thread_id = p_thread_id and m.user_id = p_user_id
  );
$$;
revoke all on function public.nffga_is_thread_member(uuid, uuid) from public, anon;
grant execute on function public.nffga_is_thread_member(uuid, uuid) to authenticated;


-- ── 4. Privileges ────────────────────────────────────────────────────
-- Supabase's default privileges grant anon and authenticated everything
-- on new tables. Narrow them to what the policies below intend.

revoke all on public.nffga_profiles       from anon;
revoke all on public.nffga_posts          from anon, authenticated;
revoke all on public.nffga_comments       from anon, authenticated;
revoke all on public.nffga_threads        from anon, authenticated;
revoke all on public.nffga_thread_members from anon, authenticated;
revoke all on public.nffga_messages       from anon, authenticated;

grant select on public.nffga_profiles to anon, authenticated;
grant insert, update, delete on public.nffga_profiles to authenticated;

grant select on public.nffga_posts to anon, authenticated;
grant insert on public.nffga_posts to authenticated;
grant update (body, photo_path, deleted_at) on public.nffga_posts to authenticated;

grant select on public.nffga_comments to anon, authenticated;
grant insert on public.nffga_comments to authenticated;
grant update (body, deleted_at) on public.nffga_comments to authenticated;

grant select on public.nffga_threads to authenticated;
grant update (subject) on public.nffga_threads to authenticated;
grant select on public.nffga_thread_members to authenticated;
grant update (last_read_at) on public.nffga_thread_members to authenticated;
grant select, insert on public.nffga_messages to authenticated;


-- ── 5. RLS ───────────────────────────────────────────────────────────

alter table public.nffga_profiles       enable row level security;
alter table public.nffga_posts          enable row level security;
alter table public.nffga_comments       enable row level security;
alter table public.nffga_threads        enable row level security;
alter table public.nffga_thread_members enable row level security;
alter table public.nffga_messages       enable row level security;

-- Profiles: public read; the owner writes their own.
drop policy if exists nffga_profiles_public_read on public.nffga_profiles;
create policy nffga_profiles_public_read on public.nffga_profiles
  for select to anon, authenticated
  using (true);

drop policy if exists nffga_profiles_insert_own on public.nffga_profiles;
create policy nffga_profiles_insert_own on public.nffga_profiles
  for insert to authenticated
  with check (user_id = auth.uid() and not public.nffga_is_guest());

drop policy if exists nffga_profiles_update_own on public.nffga_profiles;
create policy nffga_profiles_update_own on public.nffga_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists nffga_profiles_delete_own on public.nffga_profiles;
create policy nffga_profiles_delete_own on public.nffga_profiles
  for delete to authenticated
  using (user_id = auth.uid());

-- Posts, public face: everything not deleted.
drop policy if exists nffga_posts_public_read on public.nffga_posts;
create policy nffga_posts_public_read on public.nffga_posts
  for select to anon, authenticated
  using (deleted_at is null);

-- Posts, the author's and the officers' view, deleted rows included.
drop policy if exists nffga_posts_moderator_read on public.nffga_posts;
create policy nffga_posts_moderator_read on public.nffga_posts
  for select to authenticated
  using (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));

drop policy if exists nffga_posts_insert on public.nffga_posts;
create policy nffga_posts_insert on public.nffga_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and exists (select 1 from public.nffga_profiles p where p.user_id = auth.uid())
    and (kind = 'post' or public.is_nffga_officer(auth.uid()))
  );

drop policy if exists nffga_posts_no_guests on public.nffga_posts;
create policy nffga_posts_no_guests on public.nffga_posts
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());

-- Edit and soft delete, by the author or any officer. The column grant
-- above limits the client to body / photo_path / deleted_at, and
-- nffga_board_edit_guard limits officers to deleted_at on others' rows.
-- WITH CHECK does not require the row to stay publicly visible; the
-- moderator read policy above keeps it visible to the person deleting.
drop policy if exists nffga_posts_soft_delete on public.nffga_posts;
drop policy if exists nffga_posts_update on public.nffga_posts;
create policy nffga_posts_update on public.nffga_posts
  for update to authenticated
  using (author_id = auth.uid() or public.is_nffga_officer(auth.uid()))
  with check (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));

-- Comments: same shape. A comment needs a live post.
drop policy if exists nffga_comments_public_read on public.nffga_comments;
create policy nffga_comments_public_read on public.nffga_comments
  for select to anon, authenticated
  using (deleted_at is null);

drop policy if exists nffga_comments_moderator_read on public.nffga_comments;
create policy nffga_comments_moderator_read on public.nffga_comments
  for select to authenticated
  using (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));

drop policy if exists nffga_comments_insert on public.nffga_comments;
create policy nffga_comments_insert on public.nffga_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and deleted_at is null
    and exists (select 1 from public.nffga_profiles p where p.user_id = auth.uid())
    and exists (select 1 from public.nffga_posts po where po.id = post_id and po.deleted_at is null)
  );

drop policy if exists nffga_comments_no_guests on public.nffga_comments;
create policy nffga_comments_no_guests on public.nffga_comments
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());

drop policy if exists nffga_comments_soft_delete on public.nffga_comments;
drop policy if exists nffga_comments_update on public.nffga_comments;
create policy nffga_comments_update on public.nffga_comments
  for update to authenticated
  using (author_id = auth.uid() or public.is_nffga_officer(auth.uid()))
  with check (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));

-- Threads: members only. Created by nffga_start_thread() alone.
drop policy if exists nffga_threads_member_read on public.nffga_threads;
create policy nffga_threads_member_read on public.nffga_threads
  for select to authenticated
  using (public.nffga_is_thread_member(id, auth.uid()));

drop policy if exists nffga_threads_member_update on public.nffga_threads;
create policy nffga_threads_member_update on public.nffga_threads
  for update to authenticated
  using (public.nffga_is_thread_member(id, auth.uid()))
  with check (public.nffga_is_thread_member(id, auth.uid()));

-- Thread members: a member sees everyone in their threads and moves
-- only their own read marker.
drop policy if exists nffga_thread_members_member_read on public.nffga_thread_members;
create policy nffga_thread_members_member_read on public.nffga_thread_members
  for select to authenticated
  using (public.nffga_is_thread_member(thread_id, auth.uid()));

drop policy if exists nffga_thread_members_update_own on public.nffga_thread_members;
create policy nffga_thread_members_update_own on public.nffga_thread_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Messages: members read; members write as themselves.
drop policy if exists nffga_messages_member_read on public.nffga_messages;
create policy nffga_messages_member_read on public.nffga_messages
  for select to authenticated
  using (public.nffga_is_thread_member(thread_id, auth.uid()));

drop policy if exists nffga_messages_member_insert on public.nffga_messages;
create policy nffga_messages_member_insert on public.nffga_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.nffga_is_thread_member(thread_id, auth.uid())
  );

drop policy if exists nffga_messages_no_guests on public.nffga_messages;
create policy nffga_messages_no_guests on public.nffga_messages
  as restrictive for insert to authenticated
  with check (not public.nffga_is_guest());


-- ── 6. RPCs ──────────────────────────────────────────────────────────

-- The caller's profile, created on first call. Name: the argument, else
-- the display_name given at sign-up, else the email's local part.
create or replace function public.nffga_ensure_profile(p_display_name text default null)
returns public.nffga_profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p   public.nffga_profiles;
  nm  text;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if public.nffga_is_guest() then
    raise exception 'guest_not_allowed' using errcode = '42501';
  end if;

  select * into p from public.nffga_profiles where user_id = uid;
  if found then
    return p;
  end if;

  nm := nullif(btrim(coalesce(p_display_name, '')), '');
  if nm is null then
    nm := nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', '')), '');
  end if;
  if nm is null then
    nm := nullif(btrim(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)), '');
  end if;
  if nm is null then
    select nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), '') into nm
      from auth.users u where u.id = uid;
  end if;
  nm := btrim(left(coalesce(nm, 'Member'), 60));
  if nm = '' then nm := 'Member'; end if;

  insert into public.nffga_profiles (user_id, display_name)
  values (uid, nm)
  on conflict (user_id) do nothing;

  select * into p from public.nffga_profiles where user_id = uid;
  return p;
end; $$;
revoke all on function public.nffga_ensure_profile(text) from public, anon;
grant execute on function public.nffga_ensure_profile(text) to authenticated;

-- Start (or continue) a one-to-one conversation, optionally about a gear
-- listing, and send the first message. Returns { ok, thread_id }.
create or replace function public.nffga_start_thread(
  p_other           uuid,
  p_body            text,
  p_gear_listing_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  b    text := btrim(coalesce(p_body, ''));
  subj text;
  seller uuid;
  tid  uuid;
begin
  if uid is null or public.nffga_is_guest() then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if p_other is null then
    return jsonb_build_object('ok', false, 'error', 'recipient_not_found');
  end if;
  if p_other = uid then
    return jsonb_build_object('ok', false, 'error', 'cannot_message_self');
  end if;
  if char_length(b) < 1 or char_length(b) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'bad_body');
  end if;

  if p_gear_listing_id is not null then
    select l.title, l.seller_id into subj, seller
      from public.nffga_gear_listings l where l.id = p_gear_listing_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'listing_not_found');
    end if;
  end if;

  -- The recipient must be an NFFGA member (has a profile) or the seller
  -- of the listing in question. This database is shared with other
  -- products; NFFGA must not become a way to message their users.
  if not exists (select 1 from public.nffga_profiles where user_id = p_other)
     and seller is distinct from p_other then
    return jsonb_build_object('ok', false, 'error', 'recipient_not_found');
  end if;

  -- Serialize concurrent starts between the same two people about the
  -- same listing, so they cannot open twin threads.
  perform pg_advisory_xact_lock(hashtextextended(
    'nffga_thread:' || least(uid, p_other)::text || ':' || greatest(uid, p_other)::text
      || ':' || coalesce(p_gear_listing_id::text, '-'), 0));

  select t.id into tid
    from public.nffga_threads t
   where t.gear_listing_id is not distinct from p_gear_listing_id
     and exists (select 1 from public.nffga_thread_members m where m.thread_id = t.id and m.user_id = uid)
     and exists (select 1 from public.nffga_thread_members m where m.thread_id = t.id and m.user_id = p_other)
     and (select count(*) from public.nffga_thread_members m where m.thread_id = t.id) = 2
   order by t.last_message_at desc
   limit 1;

  if tid is null then
    insert into public.nffga_threads (subject, gear_listing_id)
    values (left(subj, 200), p_gear_listing_id)
    returning id into tid;
    insert into public.nffga_thread_members (thread_id, user_id, last_read_at)
    values (tid, uid, now()), (tid, p_other, null);
  end if;

  insert into public.nffga_messages (thread_id, author_id, body) values (tid, uid, b);
  update public.nffga_thread_members set last_read_at = now()
   where thread_id = tid and user_id = uid;

  return jsonb_build_object('ok', true, 'thread_id', tid);
end; $$;
revoke all on function public.nffga_start_thread(uuid, text, uuid) from public, anon;
grant execute on function public.nffga_start_thread(uuid, text, uuid) to authenticated;

-- Mark a thread read up to now, for the caller.
create or replace function public.nffga_mark_thread_read(p_thread_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  update public.nffga_thread_members set last_read_at = now()
   where thread_id = p_thread_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_mark_thread_read(uuid) from public, anon;
grant execute on function public.nffga_mark_thread_read(uuid) to authenticated;

-- Soft-delete conveniences (the direct UPDATE of deleted_at also works).
create or replace function public.nffga_delete_post(p_post_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.nffga_posts set deleted_at = now()
   where id = p_post_id and deleted_at is null
     and auth.uid() is not null
     and (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_delete_post(uuid) from public, anon;
grant execute on function public.nffga_delete_post(uuid) to authenticated;

create or replace function public.nffga_delete_comment(p_comment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.nffga_comments set deleted_at = now()
   where id = p_comment_id and deleted_at is null
     and auth.uid() is not null
     and (author_id = auth.uid() or public.is_nffga_officer(auth.uid()));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.nffga_delete_comment(uuid) from public, anon;
grant execute on function public.nffga_delete_comment(uuid) to authenticated;


-- ── 7. Realtime ──────────────────────────────────────────────────────
-- The open thread listens for new messages. Realtime applies the
-- messages' RLS, so only thread members receive them. Adds ONLY
-- nffga_messages to Supabase's standard publication, and only if it is
-- not already there.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime'
                       and schemaname = 'public' and tablename = 'nffga_messages') then
    alter publication supabase_realtime add table public.nffga_messages;
  end if;
end$$;

commit;

-- DONE.
