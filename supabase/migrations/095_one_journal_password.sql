-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 095: one journal, one password
-- ════════════════════════════════════════════════════════════════════════
-- The journal stops being two instruments (plaintext "open" entries and
-- per-entry sealed ones) and becomes one: every entry is encrypted on
-- the device under a single journal password, set once. The server
-- keeps ciphertext and the parameters to check a password against — a
-- sealed sentinel, never the password, never a hash of the password by
-- itself, never a key.
--
-- This table holds that sentinel: a known phrase sealed under the
-- journal password with the same PBKDF2-SHA256/210k + AES-256-GCM
-- machinery entries use (lib/vault.ts). Unlock = decrypt the sentinel
-- successfully. GCM authenticates, so a wrong password fails cleanly
-- and reveals nothing.
--
-- NO UPDATE POLICY, deliberately. A password change re-encrypts every
-- entry and is its own careful feature; until it exists, nothing may
-- quietly rewrite the verifier out from under the entries it guards.
-- No recovery path exists by design: lose the password, lose the words.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.journal_vaults (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  ciphertext  text not null,
  iv          text not null,
  salt        text not null,
  iterations  integer not null,
  crypto_v    integer not null,
  created_at  timestamptz not null default now()
);

alter table public.journal_vaults enable row level security;

drop policy if exists journal_vaults_select on public.journal_vaults;
create policy journal_vaults_select on public.journal_vaults
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists journal_vaults_insert on public.journal_vaults;
create policy journal_vaults_insert on public.journal_vaults
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Delete allowed: abandoning a vault orphans its entries' readability,
-- which is the author's right — it is their ash to make. The entries
-- themselves are deleted separately or not at all.
drop policy if exists journal_vaults_delete on public.journal_vaults;
create policy journal_vaults_delete on public.journal_vaults
  for delete to authenticated
  using (auth.uid() = user_id);

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   as a member: insert own row → ok; select → own row only;
--   update any row → denied (no policy).
-- DONE.
