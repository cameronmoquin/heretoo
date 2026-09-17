-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 098. Verified humans.
-- ════════════════════════════════════════════════════════════════════════
-- THE DOCTRINE REVERSAL. The public feed used to require anonymity —
-- a name in public was the violation. That rule is retired. Public
-- posting now requires the opposite: a VERIFIED IDENTITY. The feed
-- opens to the public square, the square carries names, and the gate
-- in front of it keeps the bots out.
--
-- TWO DOORS INTO VERIFIED:
--
--   invite   A current user vouched for you. Every invite path in the
--            product — crew code, /add message invite, seed invite —
--            lands an accepted `connections` row or an active
--            `family_members` row, so two triggers cover every door
--            that exists and every one built later. The vouch flows
--            FROM a verified party: two unverified accounts cannot
--            verify each other by connecting.
--
--   selfie   A photo whose camera timestamp sits within 24 hours of
--            the application. Judged server-side by the verify-selfie
--            Netlify function (service role), which reads the EXIF in
--            memory and DISCARDS THE IMAGE. Nothing lands in storage.
--            The only residue is a row in verification_attempts —
--            verdict, reason, timestamp, no pixels — which also feeds
--            the rate limit.
--
--   legacy   Everyone who existed before this migration. The platform
--            was invite-only its whole life; every existing account
--            was vouched by construction, the faculty bots included.
--            The cutoff is a fixed instant so a re-run can never
--            grandfather an account created after the doctrine.
--
-- WHAT THE FLAG GATES. Three write doors:
--
--   posts_insert          the public branch demands verified_human
--   posts_author_update   WITH CHECK blocks re-aiming a row to public
--                         without it (insert private → flip public was
--                         the two-statement bypass; see 066 for the
--                         same lesson on crew rows)
--   loft_posts_insert     the anonymous square's write door demands it
--                         too — pseudonymous is not exempt from human
--
-- Reading is untouched. An unverified account browses everything it
-- could before; it just has no public voice yet.
--
-- Service-role writers (faculty bots, Netlify functions) bypass RLS and
-- are unaffected. They are also grandfathered verified for display
-- coherence.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The flag ───────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists verified_human boolean not null default false,
  add column if not exists verified_via   text,
  add column if not exists verified_at    timestamptz;

-- ── 2. Grandfather the invite era ─────────────────────────────────────
-- Fixed cutoff, not now(): re-running this file must never verify an
-- account that signed up after the doctrine landed.
update public.profiles
   set verified_human = true,
       verified_via   = 'legacy',
       verified_at    = now()
 where not verified_human
   and created_at < timestamptz '2026-09-18 00:00:00+00';

-- ── 3. The attempts ledger. Verdicts, never pixels. ───────────────────
create table if not exists public.verification_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  verdict       text not null check (verdict in ('pass', 'fail')),
  reason        text,
  exif_taken_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.verification_attempts enable row level security;

-- Owners may read their own attempts. Nobody inserts, updates or
-- deletes through PostgREST at all — the verify-selfie function writes
-- with the service role, which does not consult policies.
drop policy if exists verification_attempts_read_own on public.verification_attempts;
create policy verification_attempts_read_own on public.verification_attempts
  for select to authenticated
  using (auth.uid() = user_id);

create index if not exists verification_attempts_user_recent
  on public.verification_attempts (user_id, created_at desc);

-- ── 4. The vouch triggers ─────────────────────────────────────────────
-- SECURITY DEFINER because the newcomer being stamped is not the row
-- author and could never pass a profiles UPDATE policy for themselves.
-- The WHERE clauses carry the whole rule: the counterpart must already
-- be verified, so verification only ever flows from the verified side.

create or replace function public.verify_on_connection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' then
    update public.profiles p
       set verified_human = true, verified_via = 'invite', verified_at = now()
     where p.id = new.recipient_id
       and not p.verified_human
       and exists (select 1 from public.profiles q
                   where q.id = new.requester_id and q.verified_human);

    update public.profiles p
       set verified_human = true, verified_via = 'invite', verified_at = now()
     where p.id = new.requester_id
       and not p.verified_human
       and exists (select 1 from public.profiles q
                   where q.id = new.recipient_id and q.verified_human);
  end if;
  return new;
end
$$;

drop trigger if exists connections_verify_vouch on public.connections;
create trigger connections_verify_vouch
  after insert or update of status on public.connections
  for each row execute function public.verify_on_connection();

create or replace function public.verify_on_family_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    -- Joining a crew vouches you only if the crew already holds a
    -- verified active member besides you.
    update public.profiles p
       set verified_human = true, verified_via = 'invite', verified_at = now()
     where p.id = new.profile_id
       and not p.verified_human
       and exists (
         select 1
         from public.family_members fm
         join public.profiles q on q.id = fm.profile_id
         where fm.family_id = new.family_id
           and fm.status = 'active'
           and fm.profile_id <> new.profile_id
           and q.verified_human
       );
  end if;
  return new;
end
$$;

drop trigger if exists family_members_verify_vouch on public.family_members;
create trigger family_members_verify_vouch
  after insert or update of status on public.family_members
  for each row execute function public.verify_on_family_join();

-- ── 5. posts_insert: the public branch demands a verified human ───────
-- Same policy as 065 wrote it, with one clause moved: 'public' leaves
-- the free list and gains the verified check. connections/private stay
-- ungated — they reach nobody a bot could want.
drop policy if exists posts_insert on public.posts;

create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      visibility in ('connections', 'private')

      or (
        visibility = 'public'
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.verified_human
        )
      )

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

-- ── 6. posts_author_update: close the two-statement bypass ────────────
-- Same policy as 066 wrote it, plus the public clause. Without it an
-- unverified account inserts a legal 'private' row and PATCHES it to
-- 'public' — the exact maneuver 066 closed for crew rows.
drop policy if exists posts_author_update on public.posts;

create policy posts_author_update on public.posts
  for update to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id

    and (
      family_id is null
      or exists (
        select 1 from public.family_members fm
        where fm.family_id = posts.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )

    and (
      direct_recipient_id is null
      or direct_recipient_id <> auth.uid()
    )

    and (
      visibility <> 'public'
      or exists (
        select 1 from public.profiles pr
        where pr.id = auth.uid() and pr.verified_human
      )
    )
  );

-- ── 7. loft_posts_insert: the anonymous door is human-only too ────────
-- The composer no longer writes here, but the API door stays and a bot
-- does not use a composer. Existing loft cards keep reading fine.
drop policy if exists loft_posts_insert on public.loft_posts;

create policy loft_posts_insert on public.loft_posts
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.verified_human
    )
  );

commit;

-- PostgREST caches the schema. Reload so the new column and policies
-- are live at once.
notify pgrst, 'reload schema';

-- DONE.
