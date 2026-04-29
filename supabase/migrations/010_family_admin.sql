-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 010: Family delete + collective-vote rename
-- ════════════════════════════════════════════════════════════════════════
-- Two governance features for families:
--
-- 1. DELETE: an owner can delete their family ONLY if they are the sole
--    active member. The moment anyone else has joined, the family is
--    a shared space and can't be unilaterally torched.
--
-- 2. RENAME: changing the family name requires majority approval. The
--    owner (or any active member) opens a rename proposal; every active
--    member votes yes or no; once strictly more than half vote yes the
--    rename auto-applies and the proposal closes. A solo-owner family
--    obviously passes 1/1 immediately.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. DELETE-WHEN-SOLO ────────────────────────────────────────────────

drop policy if exists families_delete_solo on public.families;

create policy families_delete_solo on public.families
  for delete to authenticated
  using (
    auth.uid() = owner_id
    and (
      select count(*) from public.family_members fm
      where fm.family_id = families.id and fm.status = 'active'
    ) <= 1
  );

-- ── 2. RENAME PROPOSALS ────────────────────────────────────────────────

create table if not exists public.family_rename_proposals (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families(id) on delete cascade,
  proposed_name   text not null check (length(trim(proposed_name)) between 2 and 80),
  proposed_by     uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'pending'
    check (status in ('pending', 'passed', 'failed', 'cancelled')),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days')
);

create index if not exists family_rename_proposals_family_idx
  on public.family_rename_proposals(family_id, status);

-- Only one pending proposal per family at a time. Enforced via a partial
-- unique index because Postgres doesn't allow status filters in normal
-- UNIQUE constraints.
create unique index if not exists family_rename_one_pending
  on public.family_rename_proposals(family_id)
  where status = 'pending';

create table if not exists public.family_rename_votes (
  proposal_id     uuid not null references public.family_rename_proposals(id) on delete cascade,
  voter_id        uuid not null references public.profiles(id) on delete cascade,
  vote            boolean not null,
  created_at      timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

alter table public.family_rename_proposals enable row level security;
alter table public.family_rename_votes      enable row level security;

-- Read: any active member of the proposal's family can see proposals + votes.
drop policy if exists rename_proposal_read on public.family_rename_proposals;
create policy rename_proposal_read on public.family_rename_proposals
  for select to authenticated using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_rename_proposals.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists rename_vote_read on public.family_rename_votes;
create policy rename_vote_read on public.family_rename_votes
  for select to authenticated using (
    exists (
      select 1 from public.family_rename_proposals p
      join public.family_members fm
        on fm.family_id = p.family_id
       and fm.profile_id = auth.uid()
       and fm.status = 'active'
      where p.id = family_rename_votes.proposal_id
    )
  );

-- Write paths are gated through SECURITY DEFINER RPCs so the policies
-- can stay simple "no direct writes" rules.
drop policy if exists rename_proposal_no_direct_write on public.family_rename_proposals;
create policy rename_proposal_no_direct_write on public.family_rename_proposals
  for insert to authenticated with check (false);
drop policy if exists rename_vote_no_direct_write on public.family_rename_votes;
create policy rename_vote_no_direct_write on public.family_rename_votes
  for insert to authenticated with check (false);

-- ── 3. RPC: propose a rename ───────────────────────────────────────────

create or replace function public.propose_family_rename(
  p_family_id uuid,
  p_new_name  text
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_proposer    uuid := auth.uid();
begin
  if v_proposer is null then
    raise exception 'Not authenticated';
  end if;

  -- Caller must be an active member of the family.
  if not exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and profile_id = v_proposer
      and status = 'active'
  ) then
    raise exception 'Only active members may propose a rename';
  end if;

  if length(trim(p_new_name)) < 2 then
    raise exception 'Name must be at least 2 characters';
  end if;

  -- Cancel any expired pending proposal for this family.
  update public.family_rename_proposals
     set status = 'failed', resolved_at = now()
   where family_id = p_family_id
     and status = 'pending'
     and expires_at < now();

  -- Open the new proposal.
  insert into public.family_rename_proposals (family_id, proposed_name, proposed_by)
  values (p_family_id, trim(p_new_name), v_proposer)
  returning id into v_proposal_id;

  -- Auto-record a yes vote from the proposer.
  insert into public.family_rename_votes (proposal_id, voter_id, vote)
  values (v_proposal_id, v_proposer, true);

  -- Tally immediately (handles the solo-owner case).
  perform public._tally_rename(v_proposal_id);

  return v_proposal_id;
end$$;

grant execute on function public.propose_family_rename(uuid, text) to authenticated;

-- ── 4. RPC: vote on a rename ───────────────────────────────────────────

create or replace function public.vote_family_rename(
  p_proposal_id uuid,
  p_vote        boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_voter   uuid := auth.uid();
  v_family  uuid;
  v_status  text;
begin
  if v_voter is null then
    raise exception 'Not authenticated';
  end if;

  select family_id, status into v_family, v_status
  from public.family_rename_proposals
  where id = p_proposal_id;

  if v_family is null then raise exception 'Proposal not found'; end if;
  if v_status <> 'pending' then raise exception 'This proposal is closed'; end if;

  if not exists (
    select 1 from public.family_members
    where family_id = v_family
      and profile_id = v_voter
      and status = 'active'
  ) then
    raise exception 'Only active members may vote';
  end if;

  insert into public.family_rename_votes (proposal_id, voter_id, vote)
  values (p_proposal_id, v_voter, p_vote)
  on conflict (proposal_id, voter_id)
    do update set vote = excluded.vote, created_at = now();

  perform public._tally_rename(p_proposal_id);
end$$;

grant execute on function public.vote_family_rename(uuid, boolean) to authenticated;

-- ── 5. Internal: tally a proposal and apply if it passed ───────────────

create or replace function public._tally_rename(p_proposal_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_family   uuid;
  v_name     text;
  v_status   text;
  v_total    int;
  v_yes      int;
  v_no       int;
begin
  select family_id, proposed_name, status into v_family, v_name, v_status
  from public.family_rename_proposals
  where id = p_proposal_id;

  if v_family is null or v_status <> 'pending' then return; end if;

  select count(*)::int into v_total
  from public.family_members
  where family_id = v_family and status = 'active';

  select
    count(*) filter (where vote = true)::int,
    count(*) filter (where vote = false)::int
  into v_yes, v_no
  from public.family_rename_votes
  where proposal_id = p_proposal_id;

  -- Strict majority: more than half of total active members must say yes.
  if v_yes * 2 > v_total then
    update public.families set name = v_name where id = v_family;
    update public.family_rename_proposals
       set status = 'passed', resolved_at = now()
     where id = p_proposal_id;
    return;
  end if;

  -- If enough no votes have come in that yes can never reach majority,
  -- close as failed early (gives clear feedback instead of waiting on
  -- the silent majority).
  if v_no * 2 >= v_total then
    update public.family_rename_proposals
       set status = 'failed', resolved_at = now()
     where id = p_proposal_id;
  end if;
end$$;

-- DONE.
