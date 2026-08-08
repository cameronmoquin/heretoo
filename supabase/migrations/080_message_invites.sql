-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 080: the invitation is a message
-- ════════════════════════════════════════════════════════════════════════
-- The text reads "«Name» sent you a message on HereToo" and the link
-- opens the conversation — as a guest, signed in anonymously, with the
-- phone number the sender addressed as the username. No form between
-- a person and a message addressed to them.
--
-- The number travels ON the invite because the sender typed it; the
-- platform never reads anyone's contacts.
--
-- REQUIRES a dashboard toggle: Authentication → Sign In / Up →
-- Anonymous sign-ins → ON. Without it the guest door 422s and the
-- classic sign-up path still works.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The number rides the invite ────────────────────────────────────
alter table public.seed_invites add column if not exists guest_handle text;

comment on column public.seed_invites.guest_handle is
  'The phone number (or name) the sender addressed this invite to. Becomes the guest''s username on entry. Typed by the sender — the platform reads no address books.';

-- ── 2. create_seed_invite learns the third argument ───────────────────
create or replace function public.create_seed_invite(
  message_in               text default null,
  suggested_family_name_in text default null,
  guest_handle_in          text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  tok    text;
begin
  if caller is null then
    raise exception 'Must be signed in to create a seed invite';
  end if;
  tok := encode(gen_random_bytes(9), 'hex');
  insert into public.seed_invites (token, sponsor_id, message, suggested_family_name, guest_handle)
    values (tok, caller, message_in, suggested_family_name_in, nullif(trim(coalesce(guest_handle_in, '')), ''));
  return tok;
end$$;

revoke all on function public.create_seed_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.create_seed_invite(text, text, text) to authenticated;

-- ── 3. find_seed_invite tells the guest door what to call them ────────
drop function if exists public.find_seed_invite(text);
create or replace function public.find_seed_invite(token_in text)
returns table (
  token                 text,
  sponsor_id            uuid,
  sponsor_handle        text,
  sponsor_display_name  text,
  sponsor_avatar_path   text,
  message               text,
  suggested_family_name text,
  guest_handle          text,
  used                  boolean,
  expired               boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select i.token, i.sponsor_id, p.handle, p.display_name, p.avatar_path,
         i.message, i.suggested_family_name, i.guest_handle,
         i.used_by is not null as used,
         i.expires_at < now() as expired
    from public.seed_invites i
    join public.profiles p on p.id = i.sponsor_id
   where i.token = token_in;
$$;

revoke all on function public.find_seed_invite(text) from public, anon, authenticated;
grant execute on function public.find_seed_invite(text) to anon, authenticated;

-- ── 4. Guest entry: name the guest, connect the pair, open the thread ─
-- Called by the freshly anonymous session. Sets the guest's handle and
-- display name to what the sender addressed, accepts the invite
-- (connection only, no cohort), and returns the thread with the
-- sponsor — created open, because the accepted connection makes them
-- in-network by definition.
create or replace function public.accept_message_invite(token_in text)
returns table (thread_id uuid, sponsor_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller  uuid := auth.uid();
  invite  public.seed_invites%rowtype;
  a uuid; b uuid;
  t_id uuid;
begin
  if caller is null then
    raise exception 'Must be signed in';
  end if;

  select * into invite from public.seed_invites where token = token_in;
  if not found then raise exception 'Invite not found'; end if;
  if invite.used_by is not null and invite.used_by <> caller then
    raise exception 'This invitation was already used';
  end if;
  if invite.expires_at < now() then raise exception 'This invitation expired'; end if;
  if invite.sponsor_id = caller then raise exception 'This is your own invitation'; end if;

  -- The username the sender addressed. Uniqueness by suffix, never by
  -- failure.
  if invite.guest_handle is not null then
    update public.profiles
       set handle = coalesce(handle, (
             select h from (
               select invite.guest_handle as h
               union all
               select invite.guest_handle || '-' || substr(md5(random()::text), 1, 4)
             ) cand
             where not exists (select 1 from public.profiles pp where pp.handle = cand.h)
             limit 1
           )),
           display_name = coalesce(display_name, invite.guest_handle)
     where id = caller;
  end if;

  -- The connection (idempotent), same shape 013 writes.
  if invite.sponsor_id < caller then a := invite.sponsor_id; b := caller;
  else a := caller; b := invite.sponsor_id; end if;
  insert into public.connections (requester_id, recipient_id, status, accepted_at)
    values (a, b, 'accepted', now())
    on conflict do nothing;

  update public.seed_invites set used_by = caller, used_at = now()
   where id = invite.id and used_by is null;

  -- The thread. participant_a < participant_b per the table's check.
  if invite.sponsor_id < caller then a := invite.sponsor_id; b := caller;
  else a := caller; b := invite.sponsor_id; end if;
  select mt.id into t_id from public.message_threads mt
   where mt.participant_a = a and mt.participant_b = b;
  if t_id is null then
    insert into public.message_threads (participant_a, participant_b, status, initiator_id)
      values (a, b, 'open', invite.sponsor_id)
      returning id into t_id;
  end if;

  return query select t_id, invite.sponsor_id;
end$$;

revoke all on function public.accept_message_invite(text) from public, anon, authenticated;
grant execute on function public.accept_message_invite(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- DONE.
