-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 098. Verified humans.
-- ════════════════════════════════════════════════════════════════════════
-- THE DOCTRINE REVERSAL. The public feed used to require anonymity — a
-- name in public was the violation. That rule is retired. Public posting
-- now requires a VERIFIED IDENTITY. The feed opens to the public square,
-- the square carries names, and the gate in front of it keeps bots out.
--
-- ─────────────────────────────────────────────────────────────────────
-- THIS FILE IS THE SECOND DRAFT. The first was withdrawn unrun after an
-- adversarial audit. Three of its mistakes are worth stating, because
-- each one is a trap the next migration can fall into just as easily:
--
--   1. IT REWROTE LIVE POLICIES FROM STALE TEXT. It rebuilt posts_insert
--      from 065 and loft_posts_insert from 036/044 — but the LIVE
--      policies are 083's and 085's. Rebasing silently deleted 083's
--      `not uid_is_guest()` ban and 085's binding of loft pseudonym to
--      the author's own handle: two holes those files say they PROVED
--      with live probes and closed. A migration that "moves one clause"
--      of a policy it did not re-read is a migration that reverts
--      every fix made since the version it remembers.
--
--      THE RULE THIS FILE FOLLOWS INSTEAD: never rewrite another
--      migration's policy to add a condition. Add a RESTRICTIVE policy.
--      Restrictive policies AND with the permissive ones, so this file
--      can only ever make the gate tighter — it cannot delete a clause
--      it has never heard of, including clauses added after it.
--
--   2. IT PUT THE GATE IN A COLUMN THE USER OWNS. It stored the flag on
--      public.profiles. profiles_update (001) is `using (auth.uid() =
--      id)` with NO with-check and NO column list, and no migration has
--      ever revoked the table-level UPDATE grant — so Postgres reuses
--      USING as the check, the row's id is unchanged, and one PATCH of
--      {"verified_human":true} would have opened every door. The gate
--      now lives in its own table with NO write policy at all. Not
--      guarded against writing: incapable of being written.
--
--   3. IT TRUSTED ROWS THE ATTACKER CAN CREATE. It vouched anyone who
--      appeared in an accepted `connections` row or an active
--      `family_members` row. conn_insert (001) checks only `auth.uid()
--      = requester_id` and never looks at status, so anyone could
--      insert their own pre-accepted connection naming any verified
--      stranger. fm_owner_all is FOR ALL with USING and no WITH CHECK,
--      so a crew's owner could seat any stranger at status='active' in
--      a crew they had just created. Both were one request from the
--      outside. The vouch now hangs on the only row in the system a
--      sponsor controls and a stranger cannot forge: seed_invites.
--
-- ─────────────────────────────────────────────────────────────────────
-- THREE WAYS IN:
--
--   invite   A current, verified member generated a seed invite and
--            handed over its token; accepting it consumes the row.
--            seed_self_rw (013) scopes both USING and WITH CHECK to
--            `sponsor_id = auth.uid()`, so nobody can mint an invite in
--            someone else's name or touch someone else's row, and
--            used_by is only ever set by the SECURITY DEFINER accept
--            functions, which demand the token. That makes used_by a
--            real vouch.
--
--            A CREW INVITE CODE IS NOT A VOUCH, deliberately.
--            families_invite_lookup (001) is `for select using (true)`,
--            so every crew's standing code is readable by any signed-in
--            account — joining with one proves nothing about who let
--            you in. (That the codes are world-readable at all predates
--            this file; it is logged on the punch list, not fixed here.)
--
--   selfie   A photo whose camera timestamp is within 24h of the
--            application, judged by the verify-selfie function, which
--            reads the EXIF in memory and DISCARDS the image.
--
--   legacy   Accounts that predate OPEN REGISTRATION. The first draft
--            grandfathered everyone before 2026-09-18 on the premise
--            that the platform "was invite-only its whole life". That
--            premise is false: registration opened on 2026-08-05 and
--            welcome.tsx has created accounts with no code ever since.
--            The cutoff is that date, and it is in the PAST, so a
--            re-run can never sweep in accounts made after it.
--
-- A GUEST NEVER VERIFIES. Anonymous sessions reach the product through
-- the /add message-invite door, and that door sets used_by exactly like
-- a real acceptance does. 083 and 085 fenced guests out of the public
-- surfaces on purpose; a vouch that ignored is_anonymous would have
-- walked every anonymous session straight back in.
--
-- READING IS UNTOUCHED. An unverified account browses everything it
-- could before. It simply has no public voice yet.
--
-- Service-role writers (the faculty bots, the Netlify functions) bypass
-- RLS and are unaffected by every policy here.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Refuse to run on a database missing what this file leans on ────
-- The vouch calls uid_is_guest() (083) and hangs on seed_invites (013).
-- If either is absent, the failure would not be this file erroring —
-- it would be invite acceptance breaking later, at the one moment a
-- new member is trying to get in. Fail here instead, loudly.
do $$
begin
  if to_regprocedure('public.uid_is_guest()') is null then
    raise exception
      'public.uid_is_guest() does not exist, so migration 083 has not run here. The vouch below depends on it to keep anonymous sessions out. Run 083 first.';
  end if;

  if to_regclass('public.seed_invites') is null then
    raise exception
      'public.seed_invites does not exist, so migration 013 has not run here. It is the only row this file will accept as a vouch. Run 013 first.';
  end if;
end$$;


-- ── 1. The verdict table. Nothing with a user JWT can write it. ───────
-- One row per verified human. The absence of a row IS unverified, so
-- there is no flag to flip and no false value to forge.
create table if not exists public.human_verifications (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  via        text not null check (via in ('invite', 'selfie', 'legacy', 'manual')),
  created_at timestamptz not null default now()
);

alter table public.human_verifications enable row level security;

-- Read your own verdict. That is the ONLY thing any client may do here.
drop policy if exists human_verifications_read_own on public.human_verifications;
create policy human_verifications_read_own on public.human_verifications
  for select to authenticated
  using (user_id = auth.uid());

-- There is deliberately NO insert, update or delete policy. With RLS on
-- and no policy for a command, that command matches zero rows for every
-- non-bypassing role — the table is unwritable by construction. The
-- revoke below is the second lock on the same door: Supabase grants ALL
-- on new public tables by default, and a future permissive policy added
-- in error would otherwise be the only thing standing here.
revoke insert, update, delete on public.human_verifications from authenticated, anon;


-- ── 2. The reader every policy consults ───────────────────────────────
-- SECURITY DEFINER so a policy can ask the locked table a question
-- without anyone being granted SELECT on rows that are not theirs.
create or replace function public.is_verified_human(u uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.human_verifications hv where hv.user_id = u);
$$;

revoke all on function public.is_verified_human(uuid) from public, anon;
grant execute on function public.is_verified_human(uuid) to authenticated;


-- ── 3. Grandfather the invite era, and only the invite era ────────────
-- 2026-08-05 is the day open registration shipped (welcome.tsx stopped
-- requiring a code). Accounts older than that could only have arrived
-- through an invite. Accounts newer than that may or may not have, so
-- they use one of the two live doors like anyone else.
insert into public.human_verifications (user_id, via)
select p.id, 'legacy'
from public.profiles p
where p.created_at < timestamptz '2026-08-05 00:00:00+00'
on conflict (user_id) do nothing;

-- The faculty. They write with the service role and bypass RLS, so this
-- changes nothing they can do; it keeps the ledger honest about who on
-- the platform is a known account rather than an unverified stranger.
insert into public.human_verifications (user_id, via)
select u.id, 'manual'
from auth.users u
join public.profiles p on p.id = u.id
where u.email like '%@bot.heretoo.social'
on conflict (user_id) do nothing;


-- ── 4. The attempts ledger. Verdicts, never pixels. ───────────────────
-- The selfie itself is never written anywhere. This table exists to
-- rate-limit the door and to leave the owner a trail of what was
-- decided — a verdict, a reason, and the timestamp that was read.
create table if not exists public.verification_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  verdict       text not null check (verdict in ('pass', 'fail')),
  reason        text,
  exif_taken_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.verification_attempts enable row level security;

drop policy if exists verification_attempts_read_own on public.verification_attempts;
create policy verification_attempts_read_own on public.verification_attempts
  for select to authenticated
  using (auth.uid() = user_id);

-- Same shape as above: no write policy, and the grants revoked. The
-- verify-selfie function writes with the service role.
revoke insert, update, delete on public.verification_attempts from authenticated, anon;

create index if not exists verification_attempts_user_recent
  on public.verification_attempts (user_id, created_at desc);


-- ── 5. The gate. RESTRICTIVE, so it can only ever tighten. ────────────
-- Restrictive policies are ANDed with the permissive ones rather than
-- OR'd, which is the whole point: 083's guest ban, 085's pseudonym
-- binding and every clause added after this file keep applying exactly
-- as written. This file adds one requirement and touches nothing else.
--
-- Non-public destinations are untouched — the expression is true for
-- them, so crew drops, DMs and private notes behave as they always did.

drop policy if exists posts_public_requires_human on public.posts;
create policy posts_public_requires_human on public.posts
  as restrictive for insert to authenticated
  with check (
    visibility is distinct from 'public'
    or public.is_verified_human()
  );

-- UPDATE too, or the gate is one PATCH wide: insert a legal 'private'
-- row, then flip it to 'public'. 066 closed this same maneuver for crew
-- rows and wrote down why; it applies here unchanged.
drop policy if exists posts_public_requires_human_upd on public.posts;
create policy posts_public_requires_human_upd on public.posts
  as restrictive for update to authenticated
  -- `using (true)` is explicit on purpose. USING decides which EXISTING
  -- rows an UPDATE may target, and this policy has no opinion about
  -- that — its only job is what the row may BECOME. Leaving USING off
  -- and trusting it to mean "no restriction" is a bet on a default;
  -- were it ever read as false, a restrictive policy would silently
  -- block every post edit on the platform. Say the harmless thing out
  -- loud instead.
  using (true)
  with check (
    visibility is distinct from 'public'
    or public.is_verified_human()
  );

-- The pseudonymous square is a public surface too. The composer no
-- longer writes here, but the REST door stays open and a bot does not
-- use a composer.
drop policy if exists loft_public_requires_human on public.loft_posts;
create policy loft_public_requires_human on public.loft_posts
  as restrictive for insert to authenticated
  with check (public.is_verified_human());

-- COMMENTS ARE THE SQUARE'S OTHER HALF. Gating only the authoring of
-- public posts would have left the reply box beside every one of them
-- wide open: comments_insert (083) asks for authorship, a non-guest and
-- an un-disabled thread, and nothing else. A bot farm that cannot write
-- a public post can still write its real @handle under every public
-- post on the platform, which is the same square by another door.
-- Scoped to comments ON public posts; cohort and DM threads are
-- untouched, so nothing a member says in private needs a verdict.
drop policy if exists comments_public_requires_human on public.comments;
create policy comments_public_requires_human on public.comments
  as restrictive for insert to authenticated
  with check (
    public.is_verified_human()
    or not exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and p.visibility = 'public'
    )
  );


-- ── 6. The invite vouch ───────────────────────────────────────────────
-- Fires when a seed invite is consumed. Every condition is load-bearing:
--
--   newly consumed   an UPDATE that touches used_by on an already-used
--                    row is not a second vouch
--   not a guest      anonymous sessions come through this same door and
--                    are fenced out of public surfaces by 083/085
--   sponsor verified the vouch flows FROM a verified party, so two
--                    unverified accounts can never bootstrap each other
create or replace function public.verify_on_seed_invite_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.used_by is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.used_by is not null then
    return new;
  end if;

  if public.uid_is_guest() then
    return new;
  end if;

  if not public.is_verified_human(new.sponsor_id) then
    return new;
  end if;

  insert into public.human_verifications (user_id, via)
  values (new.used_by, 'invite')
  on conflict (user_id) do nothing;

  return new;
end
$$;

drop trigger if exists seed_invites_verify_vouch on public.seed_invites;
create trigger seed_invites_verify_vouch
  after insert or update of used_by on public.seed_invites
  for each row execute function public.verify_on_seed_invite_used();

-- The first draft's two triggers are dropped by name. On a database
-- where it never ran these are no-ops; the statements exist so that a
-- database where it DID run is walked back rather than left with the
-- self-serve doors still armed.
drop trigger if exists connections_verify_vouch on public.connections;
drop trigger if exists family_members_verify_vouch on public.family_members;
drop function if exists public.verify_on_connection();
drop function if exists public.verify_on_family_join();

-- Same for the column the first draft would have added to profiles. It
-- is dropped rather than left behind, because a writable column with a
-- trustworthy name is worse than no column: the next reader would gate
-- on it.
alter table public.profiles drop column if exists verified_human;
alter table public.profiles drop column if exists verified_via;
alter table public.profiles drop column if exists verified_at;


-- ── 7. Say out loud what can still write a public row ─────────────────
-- The first draft's whole failure was a policy nobody re-read. This
-- reports the live permissive INSERT policies on both public surfaces
-- so the run itself shows what the restrictive gate is ANDing with.
do $$
declare
  p text;
  l text;
begin
  select string_agg(polname, ', ' order by polname) into p
  from pg_policy
  where polrelid = 'public.posts'::regclass and polpermissive and polcmd in ('a', '*');

  select string_agg(polname, ', ' order by polname) into l
  from pg_policy
  where polrelid = 'public.loft_posts'::regclass and polpermissive and polcmd in ('a', '*');

  raise notice 'posts INSERT permissive policies: %', coalesce(p, '(none)');
  raise notice 'loft_posts INSERT permissive policies: %', coalesce(l, '(none)');
  raise notice 'Each is now ANDed with the restrictive verified-human gate.';
end$$;

commit;

-- PostgREST caches the schema. Reload so the new tables, function and
-- policies are live at once.
notify pgrst, 'reload schema';

-- DONE.
