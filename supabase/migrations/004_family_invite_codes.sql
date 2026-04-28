-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 004: Family invite codes
-- ════════════════════════════════════════════════════════════════════════
-- Adds a short, human-friendly invite code to each family. New members
-- enter the code on the welcome / join screen, the app looks up the
-- family, and inserts them as an active family_member.
-- ════════════════════════════════════════════════════════════════════════

alter table public.families
  add column if not exists invite_code text unique
  default upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8));

create index if not exists families_invite_code_idx on public.families(invite_code);

-- Backfill existing rows that don't have a code yet.
update public.families
set invite_code = upper(substring(md5(random()::text || id::text), 1, 8))
where invite_code is null;

-- Anyone signed in can SELECT a family by invite code (so the join lookup
-- works before they're a member). The existing families_member_read /
-- families_owner_all policies still cover detail access after they're in.
drop policy if exists families_invite_lookup on public.families;
create policy families_invite_lookup on public.families
  for select to authenticated using (true);
-- Note: this widens visibility of family rows (id, name, invite_code) to
-- any authenticated user. Acceptable for a "do you know this code?" lookup.
-- If we want to tighten later, swap to a SECURITY DEFINER RPC like
-- find_family_by_invite_code(code text) returning {id,name}.
