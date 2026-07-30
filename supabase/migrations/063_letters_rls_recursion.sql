-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 063. Break the letters RLS recursion.
-- ════════════════════════════════════════════════════════════════════════
-- Sending a letter failed with "infinite recursion detected in policy for
-- relation" (Postgres 42P17). The cause is a mutual reference between two
-- SELECT policies:
--
--   letters_read           subqueries letter_recipients
--   letter_recipients_read subqueries letters
--
-- A subquery inside a policy is itself subject to the referenced table's
-- RLS, so reading one table evaluates the other's policy, which reads the
-- first, and so on. Inserting a recipient during send trips it: the
-- recipient insert's WITH CHECK reads letters, which reads
-- letter_recipients, which reads letters.
--
-- The fix: move each cross-table lookup into a SECURITY DEFINER function.
-- A definer function runs as its owner and does NOT re-apply RLS on the
-- tables it reads, so the cycle is cut. Each function only ever checks the
-- CURRENT user (auth.uid()), so it cannot leak another user's rows.
--
-- Run BY HAND. Idempotent. Atomic. Safe to re-run. No table or column
-- changes, only functions and policy bodies.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. Definer helpers ──────────────────────────────────────────────────
-- Each answers a yes/no about the calling user only. stable + security
-- definer + a pinned search_path. They read the letters tables without
-- re-triggering RLS, which is exactly what breaks the recursion.

create or replace function public.uid_is_letter_author(p_letter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letters
    where id = p_letter_id and author_id = auth.uid()
  );
$$;

create or replace function public.uid_owns_undelivered_letter(p_letter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letters
    where id = p_letter_id
      and author_id = auth.uid()
      and delivered_at is null
  );
$$;

create or replace function public.uid_is_letter_recipient(p_letter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.letter_recipients
    where letter_id = p_letter_id and user_id = auth.uid()
  );
$$;

-- These run inside RLS, so authenticated must be able to execute them.
-- anon gets nothing (PostgREST connects as anon; name all three roles).
revoke all on function public.uid_is_letter_author(uuid)         from public, anon;
revoke all on function public.uid_owns_undelivered_letter(uuid)  from public, anon;
revoke all on function public.uid_is_letter_recipient(uuid)      from public, anon;
grant execute on function public.uid_is_letter_author(uuid)        to authenticated;
grant execute on function public.uid_owns_undelivered_letter(uuid) to authenticated;
grant execute on function public.uid_is_letter_recipient(uuid)     to authenticated;

-- 2. Rewrite the cross-referencing policies to call the helpers ───────
-- Behaviour is identical to before; only the recursion is gone. The
-- author-owns and recipient-after-delivery rules are unchanged.

drop policy if exists letters_read on public.letters;
create policy letters_read on public.letters
  for select to authenticated
  using (
    auth.uid() = author_id
    or (delivered_at is not null and public.uid_is_letter_recipient(id))
  );

drop policy if exists letter_recipients_read on public.letter_recipients;
create policy letter_recipients_read on public.letter_recipients
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.uid_is_letter_author(letter_id)
  );

drop policy if exists letter_recipients_insert on public.letter_recipients;
create policy letter_recipients_insert on public.letter_recipients
  for insert to authenticated
  with check (public.uid_is_letter_author(letter_id));

drop policy if exists letter_recipients_update on public.letter_recipients;
create policy letter_recipients_update on public.letter_recipients
  for update to authenticated
  using (
    auth.uid() = user_id
    or public.uid_is_letter_author(letter_id)
  );

drop policy if exists letter_recipients_delete on public.letter_recipients;
create policy letter_recipients_delete on public.letter_recipients
  for delete to authenticated
  using (public.uid_owns_undelivered_letter(letter_id));

commit;

-- PostgREST caches the schema; reload so the new policies apply at once.
notify pgrst, 'reload schema';

-- DONE.
