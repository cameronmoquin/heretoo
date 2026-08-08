-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 079: joining asks for nothing
-- ════════════════════════════════════════════════════════════════════════
-- Accepting an invitation demanded a cohort name before the door would
-- open — a form standing between a person and the room. Wrong order.
-- Joining now creates the connection to the inviter and nothing else;
-- a cohort is started later, if ever, from inside. The old behavior
-- survives for any caller that still passes a name.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.accept_seed_invite(
  token_in       text,
  family_name_in text default null
)
returns table (family_id uuid, connection_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  invite   public.seed_invites%rowtype;
  fam_id   uuid;
  conn_id  uuid;
begin
  if caller is null then
    raise exception 'Must be signed in to accept a seed invite';
  end if;

  select * into invite from public.seed_invites where token = token_in;
  if not found then
    raise exception 'Seed invite not found';
  end if;
  if invite.used_by is not null then
    raise exception 'This seed has already been planted';
  end if;
  if invite.expires_at < now() then
    raise exception 'This seed invite has expired';
  end if;
  if invite.sponsor_id = caller then
    raise exception 'You cannot accept your own seed invite';
  end if;

  -- A cohort only when the caller brought a name. Joining alone never
  -- requires one.
  if length(trim(coalesce(family_name_in, ''))) >= 2 then
    insert into public.families (owner_id, name, description)
      values (caller, trim(family_name_in), invite.message)
      returning id into fam_id;
  end if;

  if invite.sponsor_id < caller then
    insert into public.connections (requester_id, recipient_id, status, accepted_at)
      values (invite.sponsor_id, caller, 'accepted', now())
      on conflict do nothing
      returning id into conn_id;
  else
    insert into public.connections (requester_id, recipient_id, status, accepted_at)
      values (caller, invite.sponsor_id, 'accepted', now())
      on conflict do nothing
      returning id into conn_id;
  end if;

  update public.seed_invites
     set used_by = caller, used_at = now()
   where id = invite.id;

  return query select fam_id, conn_id;
end$$;

grant execute on function public.accept_seed_invite(text, text) to authenticated;

notify pgrst, 'reload schema';

-- DONE.
