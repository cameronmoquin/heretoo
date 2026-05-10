-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 044: Loft fixes
-- ════════════════════════════════════════════════════════════════════════
-- Two issues from the field:
--   1. Loft posts fail because the loft_posts RLS policies required
--      active family membership. Users without a family (the platform
--      owner during early testing; anyone whose family hasn't yet
--      subscribed) cannot post. Relax to any-authenticated-user.
--   2. Loft handle wasn't always persisting. The claim function did
--      `update profiles where id = caller and loft_handle is null`,
--      which silently affected 0 rows if the profile somehow didn't
--      exist or the precondition was off. Tighten + add a regenerate
--      RPC so the user can swap their pseudonym from the UI.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Open loft_posts to any authenticated user ────────────────────────

drop policy if exists loft_posts_read on public.loft_posts;
create policy loft_posts_read on public.loft_posts
  for select to authenticated
  using (expires_at > now());

drop policy if exists loft_posts_insert on public.loft_posts;
create policy loft_posts_insert on public.loft_posts
  for insert to authenticated
  with check (auth.uid() = author_id);

-- Delete policy unchanged (author can delete own).

-- 2. Robust claim_loft_handle ─────────────────────────────────────────

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

  -- Make sure a profile row exists for this user. Auth signup
  -- normally creates one via a trigger; this is belt-and-suspenders.
  insert into public.profiles (id)
  values (caller)
  on conflict (id) do nothing;

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

    -- Try to claim it. UNIQUE constraint blocks collisions; we
    -- catch and retry.
    begin
      update public.profiles
        set loft_handle = candidate
        where id = caller;
      -- Confirm it actually persisted (covers the "row didn't exist" case).
      if exists (select 1 from public.profiles where id = caller and loft_handle = candidate) then
        return candidate;
      end if;
    exception when unique_violation then
      attempts := attempts + 1;
      continue;
    end;
    attempts := attempts + 1;
  end loop;

  -- Fallback: a deterministic handle derived from the user id, so
  -- even in the worst case we have something to render.
  candidate := 'guest-' || substr(replace(caller::text, '-', ''), 1, 8);
  update public.profiles set loft_handle = candidate where id = caller;
  return candidate;
end;
$$;

grant execute on function public.claim_loft_handle() to authenticated;

-- 3. NEW: regenerate_loft_handle — let the user swap their pseudonym ─

create or replace function public.regenerate_loft_handle()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  -- Clear the current handle, then re-run the claim flow.
  update public.profiles set loft_handle = null where id = caller;
  return public.claim_loft_handle();
end;
$$;

grant execute on function public.regenerate_loft_handle() to authenticated;

-- DONE.
