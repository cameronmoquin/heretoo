-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 056: The Journal (private entries, sealed or open)
-- ════════════════════════════════════════════════════════════════════════
-- One writing surface, two destinations. An entry stays open and can
-- become a book through the memoir flow, or it gets sealed and nobody
-- reads it again. Including us.
--
-- The sealing happens on the device, in lib/vault.ts: PBKDF2-SHA256 at
-- 210,000 rounds over a random 16-byte salt, then AES-GCM with a random
-- 12-byte IV. This table stores the output and nothing else.
--
-- What this table NEVER holds:
--   - the passphrase
--   - the derived key
--   - the plaintext of a sealed entry
--
-- That is enforced below by journal_entries_shape, which forces body to
-- null the moment sealed flips true. There is no recovery path. A lost
-- passphrase means the row survives and the words do not. That is the
-- feature, not a gap.
--
-- Refusal list:
--   - No service-role convenience policy. Nothing reads these rows but
--     the author. Adding a bypass here would make the claim a lie.
--   - No server-side pgcrypto. The server holding the key defeats it.
--   - No sharing, no co-author, no family visibility.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Table ────────────────────────────────────────────────────────────

create table if not exists public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,

  -- Plaintext, always, even on a sealed entry. The author needs some
  -- handle to find the thing in a list. Warn in the UI that the title
  -- is readable so nobody puts the secret in it.
  title        text,

  sealed       boolean not null default false,

  -- Plaintext body. Populated only while sealed = false.
  body         text,

  -- Sealed payload from lib/vault.ts. All base64 except the two ints.
  -- Populated only while sealed = true.
  ciphertext   text,
  iv           text,
  salt         text,
  iterations   int,
  crypto_v     int,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Shape constraint ─────────────────────────────────────────────────
-- A sealed row carries the full crypto payload and no plaintext body.
-- An unsealed row carries a body and no crypto payload. Nothing lands
-- in between.

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'journal_entries_shape'
  ) then
    alter table public.journal_entries add constraint journal_entries_shape check (
      (
        sealed = true
        and ciphertext is not null
        and iv is not null
        and salt is not null
        and iterations is not null
        and crypto_v is not null
        and body is null
      )
      or (
        sealed = false
        and body is not null
        and ciphertext is null
        and iv is null
        and salt is null
        and iterations is null
        and crypto_v is null
      )
    );
  end if;
end $$;

-- A tampered or truncated iteration count would weaken derivation on
-- the way back in. Hold the floor at the client's MIN_ITERATIONS.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'journal_entries_iterations_floor'
  ) then
    alter table public.journal_entries add constraint journal_entries_iterations_floor check (
      iterations is null or iterations >= 100000
    );
  end if;
end $$;

-- 3. Index + RLS enable ───────────────────────────────────────────────

create index if not exists journal_entries_author_idx
  on public.journal_entries (author_id, created_at desc);

alter table public.journal_entries enable row level security;

-- 4. Policies — author only, all four verbs ───────────────────────────
-- auth.uid() = author_id is the whole rule. No exceptions, no roles.

drop policy if exists journal_entries_select on public.journal_entries;
create policy journal_entries_select on public.journal_entries
  for select to authenticated
  using (auth.uid() = author_id);

drop policy if exists journal_entries_insert on public.journal_entries;
create policy journal_entries_insert on public.journal_entries
  for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists journal_entries_update on public.journal_entries;
create policy journal_entries_update on public.journal_entries
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists journal_entries_delete on public.journal_entries;
create policy journal_entries_delete on public.journal_entries
  for delete to authenticated
  using (auth.uid() = author_id);

-- anon gets nothing. Named explicitly so a future default grant does
-- not quietly open a door.
revoke all on public.journal_entries from anon;

-- 5. updated_at trigger ───────────────────────────────────────────────
-- Reuses public.set_updated_at() from migration 001.

drop trigger if exists journal_entries_updated_at on public.journal_entries;
create trigger journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- DONE.
