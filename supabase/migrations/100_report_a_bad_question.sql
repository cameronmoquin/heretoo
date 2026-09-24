-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 100. Somewhere to say "this one is wrong."
-- ════════════════════════════════════════════════════════════════════════
-- A study guide with 1,205 bank questions, 21 written chains, 43 audio
-- episodes and 17 drills will contain errors. Right now a reader who
-- spots one has nowhere to put it, and the author has no way to find out
-- except by rereading everything himself.
--
-- EVERY ARTIFACT ALREADY HAS AN IDENTIFIER. Nothing new had to be
-- invented; it only had to be written down in one place:
--
--   question   fsot_questions.id      text primary key (096). 1,205 rows.
--   guide      the page slug          /fsot/guide/<slug>.html  (21)
--   episode    the episode code       /fsot/listen/<code>.html (59)
--   drill      data-lesson=""         already on every drill box (17)
--
-- So `kind` + `ref_id` addresses any piece of the guide precisely, and the
-- reporter never has to describe WHERE the problem is — only WHAT it is.
-- The client fills both in automatically from the page.
--
-- `kind` IS NOT AN ENUM, for the reason 099 gives at length: a CHECK list
-- written today silently swallows whatever is added tomorrow, which is
-- exactly how the analytics beacon lost a year. Length is capped; meaning
-- is left open. `status` IS constrained, because that column is the
-- owner's own workflow and nothing else writes it.
--
-- THIS IS A PUBLIC WRITE DOOR, like fsot_hits, and unlike fsot_hits it
-- accepts free text. That is a real spam surface and it is bounded rather
-- than prevented: the note is capped, there is no read policy, and a
-- junk row costs a row. The alternative — making people sign in to report
-- a typo — would mean never hearing about the typo.
--
-- ON `contact`: OPTIONAL, and the only personal data here. A reader who
-- wants an answer can leave a way to reach them; a reader who does not
-- leaves it blank and is completely anonymous. Nothing else in the row
-- identifies anyone. There is no read policy, so a reported address is
-- visible only to the owner in the SQL editor. If that surface is not
-- wanted at all, drop the column — everything else still works.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Atomic.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The reports ────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id         uuid primary key default gen_random_uuid(),
  -- 'question' | 'guide' | 'episode' | 'drill' today; open by design.
  kind       text not null check (char_length(kind) between 1 and 40),
  -- The artifact's OWN id: a bank-question key, a page slug, an episode
  -- code, a drill lesson. Filled in by the page, not typed by a person.
  ref_id     text not null check (char_length(ref_id) between 1 and 200),
  -- Where they were standing when they hit report. Redundant with ref_id
  -- by design: if a client ever sends the wrong ref_id, this is how that
  -- gets noticed.
  page       text check (page is null or char_length(page) <= 200),
  note       text not null check (char_length(note) between 1 and 2000),
  contact    text check (contact is null or char_length(contact) <= 200),
  status     text not null default 'open'
             check (status in ('open', 'fixed', 'wontfix', 'duplicate')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;


-- ── 2. Write-only, for everyone ───────────────────────────────────────
-- `to anon` because the guide is read logged-out and the person who
-- finds the error is usually not a member. Requiring an account here
-- would filter out exactly the reports worth having.
drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert to anon, authenticated
  with check (
    -- A report the client did not fill in is a mis-wired page, not a
    -- report. Refuse it loudly rather than collecting blanks.
    char_length(btrim(note)) > 0
    and char_length(btrim(ref_id)) > 0
    -- `status` is the owner's column. Nobody files a report pre-resolved.
    and status = 'open'
    and resolved_at is null
  );

-- No read, update or delete policy. The owner works these in the SQL
-- editor, where postgres owns the table and RLS does not apply.
revoke all on public.content_reports from anon, authenticated;
grant insert on public.content_reports to anon, authenticated;


-- ── 3. Indexes for the way these get worked ───────────────────────────
-- "what is still open, newest first" and "everything filed against this
-- one artifact" are the only two questions this table gets asked.
create index if not exists content_reports_open
  on public.content_reports (created_at desc) where status = 'open';
create index if not exists content_reports_artifact
  on public.content_reports (kind, ref_id);


commit;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════
-- WORKING THE QUEUE. Paste into the SQL editor.
-- ════════════════════════════════════════════════════════════════════════
--
-- What is waiting?
--   select created_at::date, kind, ref_id, note, contact
--   from public.content_reports where status = 'open'
--   order by created_at desc;
--
-- Which artifact is drawing the most complaints? A question reported
-- three times is almost certainly actually wrong.
--   select kind, ref_id, count(*) as reports, max(created_at) as latest
--   from public.content_reports where status = 'open'
--   group by 1, 2 having count(*) > 1 order by 3 desc;
--
-- Pull the question a report names, side by side with the report:
--   select r.note, q.prompt, q.options, q.answer, q.explanation
--   from public.content_reports r
--   join public.fsot_questions q on q.id = r.ref_id
--   where r.kind = 'question' and r.status = 'open';
--
-- Close one out:
--   update public.content_reports
--   set status = 'fixed', resolved_at = now() where id = '<uuid>';
--
-- Close every open report against one artifact at once:
--   update public.content_reports set status = 'fixed', resolved_at = now()
--   where kind = 'guide' and ref_id = 'eras' and status = 'open';
--
-- DONE.
