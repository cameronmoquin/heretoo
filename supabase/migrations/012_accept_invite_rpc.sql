-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 012: Accept-invite RPC (fixes BLOCKING RLS error)
-- ════════════════════════════════════════════════════════════════════════
-- Bug: a new joiner clicking "Accept invite" on /join/<CODE> hits
--      "new row violates row-level security policy for table family_members"
--
-- Cause: the existing RLS on family_members allows inserts only by
--        (a) the family owner, or (b) the row subject responding to a
--        pre-existing pending invite. A brand-new joiner is neither —
--        they're inserting a fresh row about themselves into a family
--        they aren't yet a member of, which RLS correctly refuses.
--
-- Fix:   SECURITY DEFINER RPC that validates the invite code server-side
--        and inserts the family_members row with elevated privileges.
--        Idempotent: if the user already has a row for this family in
--        any status, reactivate it instead of erroring.
--
-- Security notes:
--   - Caller must be authenticated (auth.uid() is null check)
--   - Invite code is the only credential — same trust model as the
--     anon-readable preview in migration 008
--   - Function returns the family_member.id so the client can navigate
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.accept_family_invite(
  invite_code_in        text,
  relationship_label_in text default 'family'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fam_id        uuid;
  member_id     uuid;
  caller        uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Must be signed in to accept an invite';
  end if;

  if invite_code_in is null or length(trim(invite_code_in)) = 0 then
    raise exception 'Invite code is required';
  end if;

  -- Resolve the family from the (case-normalized) code.
  select id into fam_id
    from public.families
   where invite_code = upper(trim(invite_code_in))
   limit 1;

  if fam_id is null then
    raise exception 'Invite code not found';
  end if;

  -- Idempotent: if the caller already has a member row in this family,
  -- reactivate it instead of inserting a duplicate.
  select id into member_id
    from public.family_members
   where family_id = fam_id and profile_id = caller
   limit 1;

  if member_id is not null then
    update public.family_members
       set status = 'active',
           joined_at = coalesce(joined_at, now()),
           relationship_label = coalesce(
             nullif(trim(relationship_label_in), ''),
             relationship_label
           )
     where id = member_id;
    return member_id;
  end if;

  -- Fresh insert as an active member.
  insert into public.family_members (
    family_id, profile_id, relationship_label, status, joined_at
  )
  values (
    fam_id,
    caller,
    coalesce(nullif(trim(relationship_label_in), ''), 'family'),
    'active',
    now()
  )
  returning id into member_id;

  return member_id;
end$$;

grant execute on function public.accept_family_invite(text, text) to authenticated;

-- DONE.
