-- ════════════════════════════════════════════════════════════════════════
-- NFFGA — Migration 110: The admin dashboard (the back office at /admin)
-- ════════════════════════════════════════════════════════════════════════
-- Cameron, 2026-10-04: "i need there to be admin dashboard to be a
-- backpage only accessible by Tim or myself. this will approve or deny
-- requests for tournement hosts, ad or delete photos. make changes to
-- website copy and receive messages from the contact us".
--
-- WHO. A SITE ADMIN is an officer whose seat ranks >= 2 in 102's
-- nffga_role_rank: super_admin (Cameron) and managing_admin (Tim
-- O'Reilly). Other officers (president, treasurer, ...) are NOT site
-- admins. Every policy and RPC below checks nffga_is_site_admin(); the
-- dashboard's UI check is a convenience, not the guard.
--
-- WHAT THIS ADDS
--   nffga_is_site_admin(uid)      rank >= 2. Security definer.
--   nffga_site_copy               editable website text, key -> value.
--                                 Everyone reads; site admins write.
--                                 A missing key means "use the default
--                                 in constants/siteCopy.ts".
--   nffga_site_photos             photos the association posts itself
--                                 (bucket nffga-site, public), placed on
--                                 the home gallery or a room's page.
--   nffga_admin_remove_photo()    moderation: takes a member's photo off
--                                 a Clubhouse post or a gear listing, or
--                                 deletes a site photo. The client then
--                                 deletes the storage object with the
--                                 admin's own session (new storage DELETE
--                                 policies on nffga-media / nffga-gear).
--   nffga_admin_recent_photos()   the moderation list: newest member
--                                 photos across posts and gear.
--   nffga_contact_messages        Contact Us inbox. NO client insert: the
--                                 Netlify function /api/contact inserts
--                                 with the service role. Site admins read
--                                 and change status only.
--   nffga_site_admin_emails()     service role only: who the contact
--                                 function emails.
--   nffga_sync_my_admin_email()   after an admin changes their sign-in
--                                 email, moves their designation row to
--                                 the new address.
--   Event requests (107)          approve / decline / create-from-request
--                                 are now SITE ADMIN only (were: any
--                                 officer). Submitters still read their
--                                 own. Signatures unchanged.
--
-- SHARED DATABASE. Project avepftawrkwytlohobjh (EMSPCR) also serves
-- EMSPCR and Car56. Everything here is prefixed nffga_ / nffga-, refers
-- to auth.users directly, and `create or replace`s only functions NFFGA
-- created. Depends on 102, 103, 104, 105, 107, 108.
--
-- Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Preconditions ─────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.nffga_role_rank(text)') is null
     or to_regclass('public.nffga_officers') is null
     or to_regclass('public.nffga_admin_designations') is null then
    raise exception 'nffga admins missing: migration 102 has not run here.';
  end if;
  if to_regprocedure('public.nffga_touch_updated_at()') is null
     or to_regclass('public.nffga_gear_photos') is null then
    raise exception 'nffga gear trade missing: migration 103 has not run here.';
  end if;
  if to_regclass('public.nffga_posts') is null then
    raise exception 'nffga_posts missing: migration 105 has not run here.';
  end if;
  if to_regclass('public.nffga_event_requests') is null then
    raise exception 'nffga_event_requests missing: migration 107 has not run here.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'nffga_posts' and column_name = 'photo_paths') then
    raise exception 'nffga_posts.photo_paths missing: migration 108 has not run here.';
  end if;
end$$;


-- ── 1. Who is a site admin ───────────────────────────────────────────

create or replace function public.nffga_is_site_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select uid is not null and exists (
    select 1 from public.nffga_officers o
    where o.user_id = uid and public.nffga_role_rank(o.role) >= 2
  );
$$;
revoke all on function public.nffga_is_site_admin(uuid) from public, anon;
grant execute on function public.nffga_is_site_admin(uuid) to authenticated;


-- ── 2. Website copy ──────────────────────────────────────────────────

create table if not exists public.nffga_site_copy (
  key         text primary key check (key ~ '^[a-z0-9_.]{1,80}$'),
  value       text not null check (char_length(value) <= 4000),
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- Who and when come from the session, never the client.
create or replace function public.nffga_site_copy_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.updated_at := now();
  return new;
end; $$;
revoke all on function public.nffga_site_copy_stamp() from public, anon, authenticated;

drop trigger if exists nffga_site_copy_stamp_trg on public.nffga_site_copy;
create trigger nffga_site_copy_stamp_trg
  before insert or update on public.nffga_site_copy
  for each row execute function public.nffga_site_copy_stamp();

alter table public.nffga_site_copy enable row level security;
revoke all on public.nffga_site_copy from anon, authenticated;
grant select on public.nffga_site_copy to anon, authenticated;
grant insert (key, value), update (key, value), delete on public.nffga_site_copy to authenticated;

drop policy if exists nffga_site_copy_read on public.nffga_site_copy;
create policy nffga_site_copy_read on public.nffga_site_copy
  for select to anon, authenticated using (true);

drop policy if exists nffga_site_copy_insert on public.nffga_site_copy;
create policy nffga_site_copy_insert on public.nffga_site_copy
  for insert to authenticated with check (public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_copy_update on public.nffga_site_copy;
create policy nffga_site_copy_update on public.nffga_site_copy
  for update to authenticated
  using (public.nffga_is_site_admin(auth.uid()))
  with check (public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_copy_delete on public.nffga_site_copy;
create policy nffga_site_copy_delete on public.nffga_site_copy
  for delete to authenticated using (public.nffga_is_site_admin(auth.uid()));


-- ── 3. Site photos (bucket nffga-site) ───────────────────────────────

create table if not exists public.nffga_site_photos (
  id          uuid primary key default gen_random_uuid(),
  path        text not null check (char_length(path) between 1 and 400),   -- in bucket nffga-site
  caption     text check (caption is null or char_length(caption) <= 300),
  placement   text not null default 'home_gallery'
              check (placement in ('home_gallery', 'tournaments', 'gear', 'clubhouse')),
  position    integer not null default 0 check (position between 0 and 10000),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists nffga_site_photos_placement_idx on public.nffga_site_photos(placement, position, created_at);

alter table public.nffga_site_photos enable row level security;
revoke all on public.nffga_site_photos from anon, authenticated;
grant select on public.nffga_site_photos to anon, authenticated;
grant insert (path, caption, placement, position), update (caption, placement, position), delete
  on public.nffga_site_photos to authenticated;

drop policy if exists nffga_site_photos_read on public.nffga_site_photos;
create policy nffga_site_photos_read on public.nffga_site_photos
  for select to anon, authenticated using (true);

drop policy if exists nffga_site_photos_insert on public.nffga_site_photos;
create policy nffga_site_photos_insert on public.nffga_site_photos
  for insert to authenticated with check (public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_photos_update on public.nffga_site_photos;
create policy nffga_site_photos_update on public.nffga_site_photos
  for update to authenticated
  using (public.nffga_is_site_admin(auth.uid()))
  with check (public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_photos_delete on public.nffga_site_photos;
create policy nffga_site_photos_delete on public.nffga_site_photos
  for delete to authenticated using (public.nffga_is_site_admin(auth.uid()));

-- Public read by URL, like nffga-gear and nffga-media. 10 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nffga-site', 'nffga-site', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists nffga_site_objects_select on storage.objects;
create policy nffga_site_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'nffga-site' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_objects_insert on storage.objects;
create policy nffga_site_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nffga-site' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_objects_update on storage.objects;
create policy nffga_site_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'nffga-site' and public.nffga_is_site_admin(auth.uid()))
  with check (bucket_id = 'nffga-site' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_site_objects_delete on storage.objects;
create policy nffga_site_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'nffga-site' and public.nffga_is_site_admin(auth.uid()));

-- Site admins may remove (and so must be able to see) any member photo
-- in the two member buckets. Permissive: OR-ed with 103/104's own-folder
-- policies, which stay as they are.
drop policy if exists nffga_media_objects_admin_select on storage.objects;
create policy nffga_media_objects_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'nffga-media' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_media_objects_admin_delete on storage.objects;
create policy nffga_media_objects_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'nffga-media' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_gear_objects_admin_select on storage.objects;
create policy nffga_gear_objects_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'nffga-gear' and public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_gear_objects_admin_delete on storage.objects;
create policy nffga_gear_objects_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'nffga-gear' and public.nffga_is_site_admin(auth.uid()));


-- ── 4. Photo moderation ──────────────────────────────────────────────
-- p_kind 'post': p_id is the post, p_path the photo to take off it.
--   photo_paths loses it; photo_path follows (108's mirror). A post that
--   had no words and loses its last photo would break 108's "words or a
--   photo" rule, so it is soft-deleted with a placeholder body instead.
-- p_kind 'gear': p_id is the nffga_gear_photos row. It is deleted and
--   the listing's remaining photos are renumbered 0..n (ascending, one
--   row at a time, so the unique (listing_id, position) never collides).
-- p_kind 'site': p_id is the nffga_site_photos row.
-- Returns { ok, bucket, path } — the object the client should delete.

create or replace function public.nffga_admin_remove_photo(p_kind text, p_id uuid, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  po       record;
  gp       public.nffga_gear_photos;
  sp       public.nffga_site_photos;
  newpaths text[];
  i        int := 0;
  rr       record;
  emptied  boolean := false;
begin
  if uid is null or not public.nffga_is_site_admin(uid) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  if p_kind = 'post' then
    select id, body, photo_path, photo_paths into po
      from public.nffga_posts where id = p_id for update;
    if not found or p_path is null
       or not (p_path = any(po.photo_paths) or po.photo_path is not distinct from p_path) then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    newpaths := array_remove(po.photo_paths, p_path);
    emptied := cardinality(newpaths) = 0
               and (po.photo_path is null or po.photo_path = p_path)
               and char_length(btrim(coalesce(po.body, ''))) = 0;
    update public.nffga_posts
      set photo_paths = newpaths,
          photo_path  = case
                          when cardinality(newpaths) >= 1 then newpaths[1]
                          when photo_path = p_path then null
                          else photo_path
                        end,
          body        = case when emptied then 'Photo removed by an admin.' else body end,
          deleted_at  = case when emptied then coalesce(deleted_at, now()) else deleted_at end
      where id = p_id;
    return jsonb_build_object('ok', true, 'bucket', 'nffga-media', 'path', p_path, 'post_removed', emptied);

  elsif p_kind = 'gear' then
    select * into gp from public.nffga_gear_photos where id = p_id for update;
    if not found or (p_path is not null and gp.path <> p_path) then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    delete from public.nffga_gear_photos where id = gp.id;
    for rr in
      select id, position from public.nffga_gear_photos
      where listing_id = gp.listing_id order by position, created_at
    loop
      if rr.position <> i then
        update public.nffga_gear_photos set position = i where id = rr.id;
      end if;
      i := i + 1;
    end loop;
    return jsonb_build_object('ok', true, 'bucket', 'nffga-gear', 'path', gp.path, 'listing_id', gp.listing_id);

  elsif p_kind = 'site' then
    select * into sp from public.nffga_site_photos where id = p_id for update;
    if not found or (p_path is not null and sp.path <> p_path) then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
    delete from public.nffga_site_photos where id = sp.id;
    return jsonb_build_object('ok', true, 'bucket', 'nffga-site', 'path', sp.path);
  end if;

  return jsonb_build_object('ok', false, 'error', 'bad_kind');
end; $$;
revoke all on function public.nffga_admin_remove_photo(text, uuid, text) from public, anon;
grant execute on function public.nffga_admin_remove_photo(text, uuid, text) to authenticated;

-- The moderation list. Live posts' photos (photo_paths, or the legacy
-- single photo_path) and every gear listing's photos, newest first.
-- Empty for anyone who is not a site admin.
create or replace function public.nffga_admin_recent_photos(p_limit int default 60)
returns table (
  kind        text,      -- 'post' | 'gear'
  ref_id      uuid,      -- the post or the listing
  photo_id    uuid,      -- the gear photo row; null for posts
  bucket      text,
  path        text,
  owner_id    uuid,
  owner_name  text,
  title       text,      -- post body excerpt or listing title
  link        text,      -- app route to open it
  created_at  timestamptz
)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'post'::text, p.id, null::uuid, 'nffga-media'::text, ph.path,
           p.author_id, pr.display_name, left(p.body, 120), '/clubhouse/' || p.id, p.created_at
    from public.nffga_posts p
    cross join lateral unnest(
      case when cardinality(p.photo_paths) >= 1 then p.photo_paths
           when p.photo_path is not null then array[p.photo_path]
           else '{}'::text[] end
    ) as ph(path)
    left join public.nffga_profiles pr on pr.user_id = p.author_id
    where p.deleted_at is null
    union all
    select 'gear'::text, l.id, g.id, 'nffga-gear'::text, g.path,
           l.seller_id, pr.display_name, l.title, '/gear/' || l.id, g.created_at
    from public.nffga_gear_photos g
    join public.nffga_gear_listings l on l.id = g.listing_id
    left join public.nffga_profiles pr on pr.user_id = l.seller_id
  ) x (kind, ref_id, photo_id, bucket, path, owner_id, owner_name, title, link, created_at)
  where public.nffga_is_site_admin(auth.uid())
  order by x.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 300));
$$;
revoke all on function public.nffga_admin_recent_photos(int) from public, anon;
grant execute on function public.nffga_admin_recent_photos(int) to authenticated;


-- ── 5. Contact Us messages ───────────────────────────────────────────

create table if not exists public.nffga_contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  subject     text check (subject is null or char_length(subject) <= 200),
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new', 'read', 'archived')),
  ip_hash     text check (ip_hash is null or char_length(ip_hash) <= 128),
  user_id     uuid references auth.users(id) on delete set null
);
create index if not exists nffga_contact_messages_created_idx on public.nffga_contact_messages(created_at desc);
create index if not exists nffga_contact_messages_ip_idx      on public.nffga_contact_messages(ip_hash, created_at);

alter table public.nffga_contact_messages enable row level security;
revoke all on public.nffga_contact_messages from anon, authenticated;
grant select, update (status) on public.nffga_contact_messages to authenticated;
grant select, insert on public.nffga_contact_messages to service_role;

drop policy if exists nffga_contact_messages_read on public.nffga_contact_messages;
create policy nffga_contact_messages_read on public.nffga_contact_messages
  for select to authenticated using (public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_contact_messages_update on public.nffga_contact_messages;
create policy nffga_contact_messages_update on public.nffga_contact_messages
  for update to authenticated
  using (public.nffga_is_site_admin(auth.uid()))
  with check (public.nffga_is_site_admin(auth.uid()));

-- Who /api/contact notifies: the claimed super/managing admin seats; if
-- none is claimed yet, the super admin designation. Service role only.
create or replace function public.nffga_site_admin_emails()
returns table (email text)
language sql stable security definer set search_path = public as $$
  with claimed as (
    select d.email from public.nffga_admin_designations d
    join public.nffga_officers o on o.user_id = d.claimed_by
    where public.nffga_role_rank(o.role) >= 2
  )
  select email from claimed
  union
  select d.email from public.nffga_admin_designations d
  where d.role = 'super_admin' and not exists (select 1 from claimed);
$$;
revoke all on function public.nffga_site_admin_emails() from public, anon, authenticated;
grant execute on function public.nffga_site_admin_emails() to service_role;


-- ── 6. An admin's own sign-in email ──────────────────────────────────
-- A site admin may change their sign-in email from /admin (auth.users is
-- updated by Supabase Auth). The SEAT is keyed by user id in
-- nffga_officers, so it survives the change untouched. This only moves
-- the caller's designation row (claimed_by = caller) to the address
-- auth.users now holds, so the roster and the contact notifications
-- follow. Never touches the role. Refuses if another designation already
-- uses that address. Harmless for anyone without a claimed designation.

create or replace function public.nffga_sync_my_admin_email()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em  text;
  d   public.nffga_admin_designations;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  select * into d from public.nffga_admin_designations where claimed_by = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_seat');
  end if;
  select lower(btrim(coalesce(u.email, ''))) into em from auth.users u where u.id = uid;
  if em is null or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;
  if d.email = em then
    return jsonb_build_object('ok', true, 'email', em, 'changed', false);
  end if;
  if exists (select 1 from public.nffga_admin_designations where email = em) then
    return jsonb_build_object('ok', false, 'error', 'email_in_use');
  end if;
  update public.nffga_admin_designations set email = em where email = d.email;
  return jsonb_build_object('ok', true, 'email', em, 'changed', true);
end; $$;
revoke all on function public.nffga_sync_my_admin_email() from public, anon;
grant execute on function public.nffga_sync_my_admin_email() to authenticated;


-- ── 7. Event requests: site admins decide (107, tightened) ───────────

drop policy if exists nffga_event_requests_read on public.nffga_event_requests;
create policy nffga_event_requests_read on public.nffga_event_requests
  for select to authenticated
  using (submitted_by = auth.uid() or public.nffga_is_site_admin(auth.uid()));

drop policy if exists nffga_event_requests_officer_update on public.nffga_event_requests;
drop policy if exists nffga_event_requests_admin_update on public.nffga_event_requests;
create policy nffga_event_requests_admin_update on public.nffga_event_requests
  for update to authenticated
  using (public.nffga_is_site_admin(auth.uid()))
  with check (public.nffga_is_site_admin(auth.uid()));

-- Same as 107 but for the guard: site admins only.
create or replace function public.nffga_create_tournament_from_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  q     public.nffga_event_requests;
  tid   uuid;
  fmt   text;
  tname text;
begin
  if uid is null or not public.nffga_is_site_admin(uid) then
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;
  select * into q from public.nffga_event_requests where id = p_request_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if q.tournament_id is not null and exists (select 1 from public.nffga_tournaments where id = q.tournament_id) then
    if q.status <> 'approved' then
      update public.nffga_event_requests set status = 'approved' where id = q.id;
    end if;
    return jsonb_build_object('ok', true, 'tournament_id', q.tournament_id, 'already_created', true);
  end if;

  fmt := lower(regexp_replace(btrim(coalesce(q.format, '')), '[\s-]+', '_', 'g'));
  if fmt not in ('scramble', 'shamble', 'best_ball', 'stroke_play', 'stableford', 'match_play', 'alternate_shot') then
    fmt := case when fmt = '' then 'scramble' else 'other' end;
  end if;
  tname := left(btrim(q.department_name) || ' Golf Tournament', 140);

  insert into public.nffga_tournaments (
    organizer_id, status, name, format, format_notes, beneficiary,
    course_name, course_city, course_state, max_players,
    host_department, sanctioned, contact_name, contact_email, contact_phone,
    waiver_required
  ) values (
    uid, 'draft', tname, fmt,
    case when fmt = 'other' then q.format end,
    q.beneficiary, q.course_name, coalesce(q.course_city, q.city), q.state, q.expected_players,
    q.department_name, true, q.contact_name, q.contact_email, q.contact_phone,
    true
  ) returning id into tid;

  update public.nffga_event_requests
    set tournament_id = tid, status = 'approved'
    where id = q.id;

  return jsonb_build_object('ok', true, 'tournament_id', tid);
end; $$;
revoke all on function public.nffga_create_tournament_from_request(uuid) from public, anon;
grant execute on function public.nffga_create_tournament_from_request(uuid) to authenticated;

commit;

-- DONE.
