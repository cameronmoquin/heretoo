-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 055: Instant email when a followed Subject gets a post
-- ════════════════════════════════════════════════════════════════════════
-- The strategy thesis is "win the moment something is happening." The
-- in-app half of that already ships (the "New" dot on Subjects, realtime,
-- lib/subjects-activity.ts). This is the other half: the family member who
-- isn't looking at the app right now still hears about it — an email the
-- moment a post lands on a Subject they follow ("Tim's surgery").
--
-- This is deliberately NOT the daily digest (migration 027). The digest
-- is the calm, once-a-day catch-up. This is the "something is happening"
-- signal — instant, and only for Subjects the user chose to follow with
-- notify_on_post = true. It stays disciplined about the calm: opt-in per
-- Subject, honored by a per-user pref, and one email per post per person.
--
-- Three pieces:
--   1. notification_prefs.email_subject_activity — per-user master toggle
--      for these instant emails (defaults on; the daily digest toggle is
--      separate so a user can keep the calm digest but silence the pings,
--      or vice-versa).
--   2. subject_post_notifications — dedup ledger. One row per (post,
--      person) means a post tagged into two Subjects a user follows still
--      sends exactly one email, and a re-run of the worker never doubles.
--   3. pending_subject_post_notifications() — security-definer RPC the
--      Netlify worker calls to get exactly who to email, already filtered
--      by follow state, pref, authorship, and the dedup ledger.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Per-user toggle ──────────────────────────────────────────────────
alter table public.notification_prefs
  add column if not exists email_subject_activity boolean not null default true;

-- 2. Dedup ledger ─────────────────────────────────────────────────────
create table if not exists public.subject_post_notifications (
  post_id     uuid not null references public.posts(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  notified_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists subject_post_notifications_profile_idx
  on public.subject_post_notifications (profile_id, notified_at desc);

alter table public.subject_post_notifications enable row level security;

-- No client policies. This ledger is written only by the service-role
-- worker; RLS-on with no policy means authenticated clients see nothing,
-- which is correct — it holds no user-facing data.

-- 3. What to send, already filtered ───────────────────────────────────
-- Returns one row per (post, follower) pair that is due for an instant
-- email: the post was tagged onto a followed Subject within the lookback
-- window, the follower opted into notify_on_post, they didn't write it,
-- their pref allows it, and they haven't been emailed about this post yet.
--
-- distinct on (post_id, follower) collapses the case where a post is
-- tagged into several Subjects the same person follows down to one email.
create or replace function public.pending_subject_post_notifications(
  p_lookback interval default interval '2 hours',
  p_limit    int default 500
)
returns table (
  post_id            uuid,
  subject_id         uuid,
  subject_name       text,
  subject_slug       text,
  family_id          uuid,
  family_name        text,
  author_id          uuid,
  author_name        text,
  author_handle      text,
  body               text,
  post_created_at    timestamptz,
  follower_id        uuid,
  notification_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (ps.post_id, sf.profile_id)
    p.id,
    s.id,
    s.name,
    s.slug,
    s.family_id,
    f.name,
    p.author_id,
    ap.display_name,
    ap.handle,
    p.body,
    p.created_at,
    sf.profile_id,
    np.notification_email
  from public.post_subjects ps
  join public.subjects        s  on s.id = ps.subject_id
  join public.posts           p  on p.id = ps.post_id
  join public.families        f  on f.id = s.family_id
  left join public.profiles   ap on ap.id = p.author_id
  join public.subject_followers sf
    on sf.subject_id = s.id
   and sf.notify_on_post = true
  left join public.notification_prefs np on np.profile_id = sf.profile_id
  where ps.added_at >= now() - p_lookback
    and s.retired_at is null
    and sf.profile_id <> p.author_id                     -- never notify the author of their own post
    and (
      np.profile_id is null                              -- no prefs row → defaults are opt-in
      or (np.email_enabled and coalesce(np.email_subject_activity, true))
    )
    and not exists (
      select 1 from public.subject_post_notifications spn
      where spn.post_id = p.id
        and spn.profile_id = sf.profile_id
    )
  order by ps.post_id, sf.profile_id, ps.added_at
  limit p_limit;
$$;

-- Service-role only. Not granted to authenticated — the worker calls it
-- with the service key, and the security-definer body bypasses RLS on the
-- joined tables (which is what we want for a system notifier).
revoke all on function public.pending_subject_post_notifications(interval, int) from public, authenticated;

-- DONE.
