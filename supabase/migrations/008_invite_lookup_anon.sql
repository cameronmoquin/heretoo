-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 008: Anon-readable invite lookup + auto-handle helper
-- ════════════════════════════════════════════════════════════════════════
-- The /join/<CODE> share link has to work for someone who isn't signed
-- in yet — that's the whole point of a shareable link. Migration 004
-- only opened SELECT on `families` to `authenticated`, so anonymous
-- visitors get null and the page shows "Invite not found."
--
-- Fix: a SECURITY DEFINER RPC that returns a small public preview
-- (id, name, description, cover_path) for any caller, anon or signed-
-- in. The function bypasses RLS by design — it's the only path
-- exposed to anon. Detailed family data still requires membership.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.find_family_by_invite_code(code text)
returns table (
  id uuid,
  name text,
  description text,
  cover_path text
)
language sql stable security definer
set search_path = public
as $$
  select f.id, f.name, f.description, f.cover_path
  from public.families f
  where f.invite_code = upper(trim(code))
  limit 1;
$$;

-- Anon + authenticated can both call this. The function returns at most
-- one row, no sensitive fields, gated to a valid invite code.
grant execute on function public.find_family_by_invite_code(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Auto-handle on profile creation
-- ════════════════════════════════════════════════════════════════════════
-- The handle_new_user trigger from migration 001 reads
-- raw_user_meta_data->>'handle' which the express-signup flow may not
-- set. We want a sensible default so the user never has to pick one
-- up-front. Replaces the existing function — same trigger fires it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_handle text;
  candidate text;
  attempt int := 0;
begin
  -- Prefer an explicit handle from signup metadata; fall back to the
  -- email's local-part stripped of non-alphanumerics.
  base_handle := coalesce(
    new.raw_user_meta_data->>'handle',
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g'))
  );
  -- Empty (e.g. signup without email) → fall back to short uuid frag.
  if base_handle is null or length(base_handle) < 3 then
    base_handle := 'member' || substr(new.id::text, 1, 6);
  end if;
  -- Cap length and normalize.
  base_handle := substr(base_handle, 1, 24);

  -- Pick a non-colliding handle. profiles.handle has a UNIQUE
  -- constraint; loop with a numeric suffix until we land.
  candidate := base_handle;
  loop
    exit when not exists (select 1 from public.profiles where handle = candidate);
    attempt := attempt + 1;
    candidate := substr(base_handle, 1, 22) || attempt::text;
    exit when attempt > 50;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    candidate,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      initcap(regexp_replace(candidate, '[0-9]+$', ''))
    )
  )
  on conflict (id) do nothing;

  insert into public.notification_prefs (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end$$;

-- DONE.
