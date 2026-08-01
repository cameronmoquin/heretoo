-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 066. Make posts_insert the only INSERT rule.
-- ════════════════════════════════════════════════════════════════════════
-- THE HOLE. Migration 001 created posts_author_write:
--
--   for all to authenticated
--   using (auth.uid() = author_id) with check (auth.uid() = author_id)
--
-- FOR ALL covers INSERT. Permissive policies OR together. So every
-- INSERT into posts passed on authorship alone, and the crew clause in
-- posts_insert (005, rewritten in 065) was advisory. 065 named this in
-- its own header and left it alone on purpose. This file closes it.
--
-- WHAT IT COST. Any signed-in person who knew a family_id could write
-- a row with visibility='family' and that family_id. posts_read checks
-- the VIEWER's membership on the crew branch, never the author's, so
-- the row then rendered in that crew's feed for every member of it. A
-- stranger could drop into a private crew feed.
--
-- THE FIX. posts_author_write is retired and replaced by two policies,
-- one per command, because CREATE POLICY takes exactly one command.
-- INSERT is left to posts_insert, which already states the real rule.
--
--   posts_author_update   update, own rows, destination checked
--   posts_author_delete   delete, own rows
--
-- SELECT is not carried over and does not need to be. posts_read from
-- 065 opens with "auth.uid() = author_id", so an author still reads
-- every drop they wrote, burned or not.
--
-- WHY UPDATE ALSO CARRIES A DESTINATION CLAUSE. Splitting alone does
-- not close the hole. An UPDATE policy checking authorship only leaves
-- the same injection two statements long: insert a 'private' drop,
-- which is legal, then patch it to visibility='family' with a stranger
-- family_id. So the UPDATE check names the destination too. It is not
-- a copy of the posts_insert clause. It states the narrower thing that
-- actually matters after a row exists:
--
--   whatever crew this row names, you are an active member of it
--   whatever DM this row names, it is not addressed to yourself
--
-- Written that way it cannot drift into blocking an edit for a reason
-- that has nothing to do with the destination. It tolerates a row
-- whose crew was deleted (posts.family_id is ON DELETE SET NULL, so an
-- orphan keeps visibility='family' with a null family_id). An orphan
-- reaches nobody: the crew branch of posts_read requires family_id is
-- not null. And the visibility/direct_recipient_id pairing stays
-- enforced for INSERT and UPDATE alike by
-- posts_direct_recipient_pairing_check from 065, so this policy does
-- not restate it.
--
-- WHAT THIS COSTS. An author who left a crew can no longer UPDATE the
-- drops they left behind in it. Today that is one button, the
-- comments_disabled toggle in useComments.ts. They can still delete
-- them. That is the price of gating the destination at all.
--
-- INSERT PATHS AUDITED BEFORE WRITING THIS. Every one already sends a
-- row shape that posts_insert accepts:
--
--   hooks/useUpload.ts createPost, from components/feed/FeedComposer
--     author_id is the caller. Crew comes from useMyFamilies, which
--     filters status='active'. DM recipient comes from useMyConnections,
--     which filters out the caller.
--   hooks/useUpload.ts createPost, from app/family/[id]/new-post.tsx
--     crew id is the route param, with no membership gate in front of
--     it. A member passes. A non-member reaching that URL directly is
--     the hole itself and now gets a policy error instead of a post.
--   hooks/useHunt.ts useAnnounceHuntDrop
--     same two pickers, same active-only lists.
--   netlify/functions/post-shakespeare.ts
--     service role key. RLS does not apply. author_id is a bot.
--
-- No other Netlify function, no Edge function, no SECURITY DEFINER
-- function and no trigger in migrations 001 through 065 inserts into
-- public.posts. The only UPDATE is comments_disabled. The only DELETE
-- is useFeed.ts useDeletePost. Both keep working.
--
-- WHAT THIS FILE DOES NOT DO. It does not touch posts_insert, which
-- stays exactly as 065 wrote it. It does not touch posts_read. It
-- renames nothing: no code addresses a policy by name, and the two new
-- policies are new objects, not a renamed one.
--
-- Run BY HAND. Idempotent. Atomic. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. Refuse to run on a database that predates 065 ──────────────────
-- Dropping the FOR ALL policy is only safe when a real INSERT rule is
-- already in place. On a pre-065 database posts_insert is still the 005
-- gate, which knows nothing about 'direct' and demands a crew before
-- any public drop. Retiring the fallback there would break posting
-- instead of tightening it. Two checks, because the 005 policy carries
-- the same name: the policy must exist AND 065's column must exist.
do $$
declare
  has_insert_policy boolean;
  has_direct_col    boolean;
begin
  select exists (
    select 1 from pg_policy p
    where p.polrelid = 'public.posts'::regclass
      and p.polname = 'posts_insert'
      and p.polcmd in ('a', '*')
  ) into has_insert_policy;

  select exists (
    select 1 from pg_attribute a
    where a.attrelid = 'public.posts'::regclass
      and a.attname = 'direct_recipient_id'
      and not a.attisdropped
  ) into has_direct_col;

  if not has_insert_policy then
    raise exception
      'public.posts has no INSERT policy named posts_insert. Run 065 first. Without it this file leaves the table with no INSERT rule at all.';
  end if;

  if not has_direct_col then
    raise exception
      'public.posts has no direct_recipient_id column, so migration 065 has not run here. Run it first.';
  end if;
end$$;


-- ── 1. Retire the FOR ALL policy ──────────────────────────────────────
-- This is the whole fix. Everything below restores what it legitimately
-- granted, one command at a time.
drop policy if exists posts_author_write on public.posts;


-- ── 2. UPDATE. Own rows. Destination checked. ─────────────────────────
-- USING is the old row: it is yours. WITH CHECK is the new row: it is
-- still yours, and it is not landing anywhere you have no right to be.
drop policy if exists posts_author_update on public.posts;

create policy posts_author_update on public.posts
  for update to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id

    -- Names a crew: be in it, active. Names none: nothing to check.
    and (
      family_id is null
      or exists (
        select 1 from public.family_members fm
        where fm.family_id = posts.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )

    -- Names a person: not yourself. Matches the posts_insert DM rule.
    and (
      direct_recipient_id is null
      or direct_recipient_id <> auth.uid()
    )
  );


-- ── 3. DELETE. Own rows. ──────────────────────────────────────────────
-- Unchanged from what posts_author_write granted. A drop you wrote is
-- a drop you can take back, wherever it landed and whether or not you
-- are still in that crew.
drop policy if exists posts_author_delete on public.posts;

create policy posts_author_delete on public.posts
  for delete to authenticated
  using (auth.uid() = author_id);


-- ── 4. Say out loud what can still insert ─────────────────────────────
-- The whole bug was a second permissive policy nobody was counting. If
-- this database has another one, the run says so rather than leaving
-- the next reader to assume posts_insert is alone. Report only. A
-- policy this file does not know about is not a policy it should drop.
do $$
declare
  extra text;
begin
  select string_agg(p.polname, ', ' order by p.polname) into extra
  from pg_policy p
  where p.polrelid = 'public.posts'::regclass
    and p.polpermissive
    and p.polcmd in ('a', '*')
    and p.polname <> 'posts_insert';

  if extra is null then
    raise notice 'public.posts INSERT is gated by posts_insert alone.';
  else
    raise warning
      'public.posts still has INSERT-capable permissive policies besides posts_insert: %. Permissive policies OR together, so the crew clause is still advisory. Review them.',
      extra;
  end if;
end$$;

commit;

-- PostgREST caches the schema. Reload so the new policies are live at
-- once.
notify pgrst, 'reload schema';

-- DONE.
