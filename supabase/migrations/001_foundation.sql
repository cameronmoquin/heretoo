-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 001: Foundation
-- ════════════════════════════════════════════════════════════════════════
-- Covers: Profiles, Notification Preferences, Families (user-defined graph),
--         Connections, Messages, Posts, Post Media, Art Works skeleton.
-- Platform: Supabase (Postgres 15+ with pgcrypto, auth.users from Supabase Auth)
--
-- This is a CLEAN-SLATE foundation. The "Reset legacy tables" block at the
-- top drops everything from earlier iterations of this codebase (pulse,
-- bridge, wamp, candon_*, the old posts/profiles shape). Then it rebuilds
-- from scratch in the new shape.
--
-- Run order: paste the entire file once, click Run. Order matters.
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── Reset legacy tables (everything from earlier attempts) ─────────────
-- Drops in dependency order. Storage objects in dropped buckets are NOT
-- removed by this; clean those up via the dashboard if needed.
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.candon_post_view_log         cascade;
drop table if exists public.candon_inbound_emails        cascade;
drop table if exists public.candon_family_medical_updates cascade;
drop table if exists public.candon_family_post_recipients cascade;
drop table if exists public.candon_event_rsvps           cascade;
drop table if exists public.candon_family_assignments    cascade;
drop table if exists public.candon_family_events         cascade;
drop table if exists public.candon_family_posts          cascade;
drop table if exists public.candon_family_memberships    cascade;
drop table if exists public.candon_family_groups         cascade;
drop table if exists public.candon_contact_tags          cascade;
drop table if exists public.candon_contacts              cascade;
drop table if exists public.candon_user_profiles         cascade;
drop table if exists public.candon_notification_jobs     cascade;

drop table if exists public.family_members              cascade;
drop table if exists public.family_groups               cascade;

drop table if exists public.pulse_votes                 cascade;
drop table if exists public.pulse_statements            cascade;
drop table if exists public.pulse_topics                cascade;
drop table if exists public.bridge_messages             cascade;
drop table if exists public.bridge_sessions             cascade;
drop table if exists public.bridging_score_history      cascade;
drop table if exists public.trust_score_history         cascade;
drop table if exists public.wamp_transactions           cascade;
drop table if exists public.wamp_balances               cascade;

drop table if exists public.engagements                 cascade;
drop table if exists public.follows                     cascade;
drop table if exists public.comments                    cascade;
drop table if exists public.post_tags                   cascade;
drop table if exists public.invites                     cascade;
drop table if exists public.rate_limits                 cascade;
drop table if exists public.bot_detection_signals       cascade;
drop table if exists public.flagged_content             cascade;
drop table if exists public.user_suspensions            cascade;
drop table if exists public.ad_categories               cascade;
drop table if exists public.ad_policy_rules             cascade;
drop table if exists public.ad_preferences              cascade;
drop table if exists public.posts                       cascade;
drop table if exists public.profiles                    cascade;
drop table if exists public.art_reservoir               cascade;

drop function if exists public.candon_is_family_member(uuid)        cascade;
drop function if exists public.candon_family_role(uuid)             cascade;
drop function if exists public.candon_can_view_post(uuid)           cascade;
drop function if exists public.candon_auto_add_owner_membership()   cascade;
drop function if exists public.candon_whoami(uuid)                  cascade;
drop function if exists public.candon_family_ancestry(uuid)         cascade;
drop function if exists public.get_candon_network_stats()           cascade;
drop function if exists public.family_groups_add_owner_membership() cascade;
drop function if exists public.credit_wamp(uuid, numeric, text, text) cascade;

-- ── Helper: updated_at auto-bump ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. PROFILES — one row per auth.users, created via trigger on signup
-- ════════════════════════════════════════════════════════════════════════
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  handle          citext unique not null check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name    text not null,
  bio             text,
  avatar_path     text,
  phone_e164      text,
  phone_verified  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile + notification prefs shell on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    'user_' || substr(new.id::text, 1, 8),
    coalesce(new.raw_user_meta_data->>'display_name', 'New Member')
  );
  insert into public.notification_prefs (profile_id) values (new.id);
  return new;
end$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. NOTIFICATION PREFERENCES — per-event, per-channel opt-ins
-- ════════════════════════════════════════════════════════════════════════
create table public.notification_prefs (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  email_enabled       boolean not null default true,
  sms_enabled         boolean not null default false,
  email_connection_request  boolean not null default true,
  email_connection_accepted boolean not null default true,
  email_new_message         boolean not null default true,
  email_family_activity     boolean not null default true,
  email_post_reaction       boolean not null default false,
  email_marketing           boolean not null default false,
  sms_connection_request    boolean not null default false,
  sms_new_message           boolean not null default false,
  sms_family_activity       boolean not null default false,
  sms_opt_in_at       timestamptz,
  sms_opt_in_ip       inet,
  email_unsub_token   uuid not null default gen_random_uuid(),
  updated_at          timestamptz not null default now()
);

create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 3. FAMILIES (user-defined graph) — any structure, free-text relationships
-- ════════════════════════════════════════════════════════════════════════
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  cover_path  text,
  is_private  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger families_updated_at before update on public.families
  for each row execute function public.set_updated_at();
create index families_owner_idx on public.families(owner_id);

create table public.family_members (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families(id) on delete cascade,
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  relationship_label  text not null,
  invited_by          uuid references public.profiles(id),
  status              text not null default 'pending'
                      check (status in ('pending', 'active', 'declined', 'removed')),
  joined_at           timestamptz,
  created_at          timestamptz not null default now(),
  unique (family_id, profile_id)
);
create index family_members_profile_idx on public.family_members(profile_id);
create index family_members_family_idx  on public.family_members(family_id);

-- Auto-add the owner as an active member when a family is created.
create or replace function public.families_add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.family_members (family_id, profile_id, relationship_label, status, joined_at)
  values (new.id, new.owner_id, 'owner', 'active', now())
  on conflict do nothing;
  return new;
end$$;

drop trigger if exists families_owner_member on public.families;
create trigger families_owner_member
  after insert on public.families
  for each row execute function public.families_add_owner_member();

-- ════════════════════════════════════════════════════════════════════════
-- 4. CONNECTIONS — explicit, mutual, optional (family auto-handles most)
-- ════════════════════════════════════════════════════════════════════════
create table public.connections (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> recipient_id),
  unique (requester_id, recipient_id)
);
create index connections_recipient_idx on public.connections(recipient_id, status);
create index connections_requester_idx on public.connections(requester_id, status);

-- ════════════════════════════════════════════════════════════════════════
-- 5. DIRECT MESSAGES
-- ════════════════════════════════════════════════════════════════════════
create table public.message_threads (
  id            uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  check (participant_a < participant_b),
  unique (participant_a, participant_b)
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on public.messages(thread_id, created_at desc);

create or replace function public.bump_thread_activity()
returns trigger language plpgsql as $$
begin
  update public.message_threads
    set last_message_at = new.created_at
    where id = new.thread_id;
  return new;
end$$;

create trigger messages_bump_thread after insert on public.messages
  for each row execute function public.bump_thread_activity();

-- ════════════════════════════════════════════════════════════════════════
-- 6. POSTS (text + media via post_media)
-- ════════════════════════════════════════════════════════════════════════
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text,
  visibility  text not null default 'connections'
              check (visibility in ('public', 'connections', 'family', 'private')),
  family_id   uuid references public.families(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create index posts_author_idx on public.posts(author_id, created_at desc);
create index posts_family_idx on public.posts(family_id, created_at desc);

create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  media_type   text not null check (media_type in ('image', 'video', 'audio')),
  width        int,
  height       int,
  duration_ms  int,
  alt_text     text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index post_media_post_idx on public.post_media(post_id, position);

-- ════════════════════════════════════════════════════════════════════════
-- 7. ART WORKS (skeleton — populated by Phase 6 ingestion pipeline)
-- ════════════════════════════════════════════════════════════════════════
create table public.art_works (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  source_id       text,
  uploader_id     uuid references public.profiles(id) on delete set null,
  title           text,
  artist          text,
  year_created    text,
  genre           text[],
  school          text,
  medium          text,
  storage_path    text not null,
  thumb_path      text,
  width           int,
  height          int,
  palette         jsonb,
  dominant_hue    int,
  license         text not null,
  source_url      text,
  description     text,
  created_at      timestamptz not null default now(),
  unique (source, source_id)
);

create index art_works_hue_idx    on public.art_works(dominant_hue);
create index art_works_genre_idx  on public.art_works using gin (genre);
create index art_works_school_idx on public.art_works(school);

-- ════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles            enable row level security;
alter table public.notification_prefs  enable row level security;
alter table public.families            enable row level security;
alter table public.family_members      enable row level security;
alter table public.connections         enable row level security;
alter table public.message_threads     enable row level security;
alter table public.messages            enable row level security;
alter table public.posts               enable row level security;
alter table public.post_media          enable row level security;
alter table public.art_works           enable row level security;

create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy profiles_self_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy notif_owner_all on public.notification_prefs
  for all to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy families_owner_all on public.families
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy families_member_read on public.families
  for select to authenticated using (
    exists (select 1 from public.family_members fm
            where fm.family_id = families.id
              and fm.profile_id = auth.uid()
              and fm.status = 'active')
  );

create policy fm_owner_all on public.family_members
  for all to authenticated using (
    exists (select 1 from public.families f
            where f.id = family_members.family_id and f.owner_id = auth.uid())
  );
create policy fm_self_read on public.family_members
  for select to authenticated using (auth.uid() = profile_id);
create policy fm_self_respond on public.family_members
  for update to authenticated using (auth.uid() = profile_id);
-- Family-mate read: members can see the roster of their own families
create policy fm_member_read on public.family_members
  for select to authenticated using (
    exists (select 1 from public.family_members fm
            where fm.family_id = family_members.family_id
              and fm.profile_id = auth.uid()
              and fm.status = 'active')
  );

create policy conn_read on public.connections
  for select to authenticated using (auth.uid() in (requester_id, recipient_id));
create policy conn_insert on public.connections
  for insert to authenticated with check (auth.uid() = requester_id);
create policy conn_update on public.connections
  for update to authenticated using (auth.uid() in (requester_id, recipient_id));

create policy threads_read on public.message_threads
  for select to authenticated using (auth.uid() in (participant_a, participant_b));
create policy threads_insert on public.message_threads
  for insert to authenticated with check (auth.uid() in (participant_a, participant_b));

create policy messages_read on public.messages
  for select to authenticated using (
    exists (select 1 from public.message_threads t
            where t.id = messages.thread_id
              and auth.uid() in (t.participant_a, t.participant_b))
  );
create policy messages_send on public.messages
  for insert to authenticated with check (
    auth.uid() = sender_id
    and exists (select 1 from public.message_threads t
                where t.id = messages.thread_id
                  and auth.uid() in (t.participant_a, t.participant_b))
  );

-- Posts read: visibility-driven. Private = self only, public = anyone, family
-- = family members, connections = explicit connections OR family-network mesh.
-- (The connections branch references family_network_reach() defined in 003.)
create policy posts_read on public.posts
  for select to authenticated using (
    visibility = 'public'
    or auth.uid() = author_id
    or (visibility = 'family' and family_id is not null and exists (
          select 1 from public.family_members fm
          where fm.family_id = posts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'))
    or (visibility = 'connections' and exists (
          select 1 from public.connections c
          where c.status = 'accepted'
            and ((c.requester_id = auth.uid() and c.recipient_id = posts.author_id)
              or (c.recipient_id = auth.uid() and c.requester_id = posts.author_id))))
  );

create policy posts_author_write on public.posts
  for all to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy post_media_read on public.post_media
  for select to authenticated using (
    exists (select 1 from public.posts p where p.id = post_media.post_id)
  );
create policy post_media_author on public.post_media
  for all to authenticated using (
    exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_id = auth.uid())
  );

create policy art_read on public.art_works
  for select to authenticated using (true);
create policy art_uploader_write on public.art_works
  for all to authenticated using (auth.uid() = uploader_id) with check (auth.uid() = uploader_id);

-- ════════════════════════════════════════════════════════════════════════
-- AUTH HOOK
-- ════════════════════════════════════════════════════════════════════════
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- BACKFILL: profiles + notification_prefs for any existing auth.users
-- ════════════════════════════════════════════════════════════════════════
insert into public.profiles (id, handle, display_name)
select
  u.id,
  'user_' || substr(u.id::text, 1, 8),
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Member')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

insert into public.notification_prefs (profile_id)
select u.id from auth.users u
left join public.notification_prefs np on np.profile_id = u.id
where np.profile_id is null;
