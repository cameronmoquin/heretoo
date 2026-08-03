-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 068: the pseudonym nobody could claim
-- ════════════════════════════════════════════════════════════════════════
-- THE BUG. claim_loft_handle has raised on every call since 044.
--
-- 044 added this, as belt-and-suspenders in case the signup trigger had
-- not made a profile row:
--
--     insert into public.profiles (id) values (caller)
--     on conflict (id) do nothing;
--
-- public.profiles.handle is `citext unique not null`, and display_name is
-- `text not null`. Postgres evaluates NOT NULL on the candidate tuple
-- BEFORE it arbitrates ON CONFLICT, so that statement raises 23502
-- whether or not the row already exists. The guard could never fire the
-- way it reads: it failed closed, for everybody, always.
--
-- Observed in production 2026-08-03 as a 400 on /rest/v1/rpc/
-- claim_loft_handle carrying:
--   null value in column "handle" of relation "profiles" violates
--   not-null constraint
--
-- WHAT IT COST. useLoftHandle calls this on mount, so no account created
-- since 044 has ever held a Loft pseudonym. The composer gates its Public
-- destination on `!!loftHandle` (components/feed/FeedComposer.tsx), so
-- Public has been un-postable for every one of them. regenerate_loft_handle
-- delegates here too, so "change pseudonym" was dead by the same route.
-- Handles predating 044 still work; they were claimed by 036's version,
-- which had no such insert.
--
-- THE FIX. Drop the insert. A profile cannot be conjured here anyway —
-- handle has to satisfy `^[a-z0-9_]{3,24}$` and be unique, display_name
-- has to be non-null, and inventing either behind the caller's back is
-- how you get a junk row that the signup flow then collides with. If the
-- row is genuinely absent, that is a broken account and it should say so.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. claim_loft_handle, without the poisoned guard ─────────────────
-- Body is 044's, unchanged except that the insert becomes an existence
-- check. Same retry loop, same 16 attempts, same deterministic fallback.
create or replace function public.claim_loft_handle()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  existing text;
  attempts int := 0;
  candidate text;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  -- Was a blind insert. See the header. The signup trigger owns profile
  -- creation; this only refuses to guess when it has not happened.
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'No profile for this account';
  end if;

  select loft_handle into existing from public.profiles where id = caller;
  if existing is not null and existing <> '' then
    return existing;
  end if;

  while attempts < 16 loop
    candidate := (
      array['quiet','patient','tall','old','small','calm','bright','low','warm','plain','soft','far']
    )[1 + floor(random() * 12)::int]
    || '-' ||
    (
      array['fox','otter','wren','heron','hare','crow','elk','deer','bee','snail','toad','newt']
    )[1 + floor(random() * 12)::int]
    || '-' || lpad((floor(random() * 1000))::int::text, 3, '0');

    begin
      update public.profiles
        set loft_handle = candidate
        where id = caller;
      if exists (select 1 from public.profiles where id = caller and loft_handle = candidate) then
        return candidate;
      end if;
    exception when unique_violation then
      attempts := attempts + 1;
      continue;
    end;
    attempts := attempts + 1;
  end loop;

  candidate := 'guest-' || substr(replace(caller::text, '-', ''), 1, 8);
  update public.profiles set loft_handle = candidate where id = caller;
  return candidate;
end;
$$;


-- ── 2. Grants on both loft-handle functions ──────────────────────────
-- Both are `security definer` and both write to public.profiles, so they
-- are exactly the shape 059 had to clean up. All three roles named:
-- revoking from public and authenticated alone leaves Supabase's direct
-- EXECUTE grant to `anon` in place, and PostgREST connects as `anon` for
-- unauthenticated requests.
--
-- An anon caller would hit the `auth.uid() is null` guard and get
-- 'Not signed in' rather than writing anything, so this is defence in
-- depth rather than a hole being closed. Name the roles anyway.
revoke all on function public.claim_loft_handle() from public, anon, authenticated;
grant execute on function public.claim_loft_handle() to authenticated;

revoke all on function public.regenerate_loft_handle() from public, anon, authenticated;
grant execute on function public.regenerate_loft_handle() to authenticated;


-- ── 3. Verify ────────────────────────────────────────────────────────
-- Locked to signed-in callers. With the publishable anon key, both:
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     -X POST "$SUPABASE_URL/rest/v1/rpc/claim_loft_handle" \
--     -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' -d '{}'
--
-- 401 or 404 is correct; 200 means step 2 did not take.
--
-- Then, signed in, open the composer and switch to Public. The byline
-- should read "You are <adjective>-<animal>-<nnn>" instead of
-- "You are unnamed", and the send button should enable on any text.

-- DONE.
