-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 085: the guest boundary, finished
-- ════════════════════════════════════════════════════════════════════════
-- 083 drew the line at posts, comments, reactions and hunt photos. A
-- deeper audit found the write surfaces it missed, and three holes open
-- to any signed-in account. Everything below was PROVEN with a live
-- probe from a throwaway anonymous session unless marked (read).
--
--   A. a guest could author LETTERS, which the delivery worker mails to
--      a member's real address, up to 50,000 characters.
--   B. a guest could post to the PUBLIC SQUARE under any pseudonym at
--      all, including one belonging to somebody else.
--   C. a guest could read the ENTIRE member directory, 114 profiles,
--      in a single request.
--   D. (read) letter_recipients had UPDATE with no WITH CHECK, so any
--      account could re-point a recipient row it owns at another
--      person's letter and then read that letter's body.
--   E. (read) subjects_update re-checked only authorship, so a subject
--      could be moved into a stranger's cohort.
--   F. (read) video_call_participants had an unpoliced UPDATE: change
--      call_id and appear in any call.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── A. Letters are written by members ────────────────────────────────
drop policy if exists letters_insert on public.letters;
create policy letters_insert on public.letters
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and not public.uid_is_guest()
    and deliver_at > now()
  );

drop policy if exists letter_recipients_insert on public.letter_recipients;
create policy letter_recipients_insert on public.letter_recipients
  for insert to authenticated
  with check (
    not public.uid_is_guest()
    and public.uid_is_letter_author(letter_id)
  );

-- D. The missing WITH CHECK. Without it a row could be re-pointed at
-- somebody else's letter, and letter_recipients_read then handed over
-- that letter's body.
drop policy if exists letter_recipients_update on public.letter_recipients;
create policy letter_recipients_update on public.letter_recipients
  for update to authenticated
  using (public.uid_is_letter_author(letter_id))
  with check (public.uid_is_letter_author(letter_id));


-- ── B. The square is for members, under their own pseudonym ──────────
-- The pseudonym is the Loft's whole identity model, and nothing bound
-- it to the author's claimed handle: any account could publish as any
-- name. Now it must match the handle the author actually holds.
drop policy if exists loft_posts_insert on public.loft_posts;
create policy loft_posts_insert on public.loft_posts
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and not public.uid_is_guest()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.loft_handle is not null
        and p.loft_handle = loft_posts.pseudonym
    )
  );


-- ── C. A guest sees the people it is actually connected to ───────────
-- Members keep the directory as it was; scoping that is the cohort
-- doctrine's job, not this migration's. A guest gets only itself, the
-- person who invited it, and anyone it shares a thread with, which is
-- exactly what the thread header needs.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    not public.uid_is_guest()
    or id = auth.uid()
    or exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((c.requester_id = auth.uid() and c.recipient_id = profiles.id)
          or (c.recipient_id = auth.uid() and c.requester_id = profiles.id))
    )
    or exists (
      select 1 from public.message_threads mt
      where (mt.participant_a = auth.uid() and mt.participant_b = profiles.id)
         or (mt.participant_b = auth.uid() and mt.participant_a = profiles.id)
    )
  );


-- ── E. A subject stays in the cohort it was made for ─────────────────
drop policy if exists subjects_update on public.subjects;
create policy subjects_update on public.subjects
  for update to authenticated
  using (
    auth.uid() = created_by
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = subjects.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  )
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = subjects.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );


-- ── F. A participant row cannot walk into another call ───────────────
drop policy if exists video_call_participants_update on public.video_call_participants;
create policy video_call_participants_update on public.video_call_participants
  for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.video_calls vc
      where vc.id = video_call_participants.call_id
        and public.uid_in_call_scope(vc.family_id, vc.thread_id)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.video_calls vc
      where vc.id = video_call_participants.call_id
        and public.uid_in_call_scope(vc.family_id, vc.thread_id)
    )
  );

-- Only the host hangs up the room; anyone in scope could rewrite any
-- column of any call before this, host_id included.
drop policy if exists video_calls_update on public.video_calls;
create policy video_calls_update on public.video_calls
  for update to authenticated
  using (
    auth.uid() = host_id
    and public.uid_in_call_scope(family_id, thread_id)
  )
  with check (
    auth.uid() = host_id
    and public.uid_in_call_scope(family_id, thread_id)
  );

drop policy if exists video_calls_insert on public.video_calls;
create policy video_calls_insert on public.video_calls
  for insert to authenticated
  with check (
    auth.uid() = host_id
    and not public.uid_is_guest()
    and public.uid_in_call_scope(family_id, thread_id)
  );


-- ── The rest of the guest boundary ───────────────────────────────────
-- A guest with no recovery credential should not be sealing a journal
-- behind a passphrase it will lose with the browser.
drop policy if exists journal_entries_insert on public.journal_entries;
create policy journal_entries_insert on public.journal_entries
  for insert to authenticated
  with check (auth.uid() = author_id and not public.uid_is_guest());

drop policy if exists babybooks_self_insert on public.babybooks;
create policy babybooks_self_insert on public.babybooks
  for insert to authenticated
  with check (auth.uid() = author_id and not public.uid_is_guest());

drop policy if exists babybook_entries_self_insert on public.babybook_entries;
create policy babybook_entries_self_insert on public.babybook_entries
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and not public.uid_is_guest()
    and public.uid_in_babybook(babybook_id)
  );

drop policy if exists babybook_assets_self_insert on public.babybook_assets;
create policy babybook_assets_self_insert on public.babybook_assets
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and not public.uid_is_guest()
    and public.uid_in_babybook(babybook_id)
  );

-- A count of somebody else's cohort's posts is not an anonymous fact.
revoke all on function public.subject_post_count(uuid) from public, anon, authenticated;
grant execute on function public.subject_post_count(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify (from a throwaway anonymous session, all should fail) ─────
--   insert into letters            → denied
--   insert into loft_posts         → denied
--   select from profiles (bulk)    → only self + sponsor
--   update letter_recipients.letter_id to another letter → denied
-- DONE.
