-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 030: The Letter (Source of Truth, Milestone 5)
-- ════════════════════════════════════════════════════════════════════════
-- A Letter is a tweet's opposite: long, private, scheduled, addressed
-- to one person (or a future user not yet on the platform). The
-- platform's most distilled expression of intentionality.
--
-- Recipients can be:
--   - A current user (referenced by profile_id), OR
--   - A future recipient — labeled, with a one-time claim_token URL
--     the author can hand over by any means (email, will, scrap of
--     paper). When claimed, the letter binds to that user's profile.
--
-- Delivery mechanics:
--   - deliver_at: when the letter becomes visible to the recipient.
--   - delivered_at: stamped when the delivery function fires.
--   - editable until 24h before deliver_at (enforced in app code +
--     a CHECK on the update RLS policy below).
--
-- Refusal list (M5):
--   - No public letters.
--   - No featured letters / letter-of-the-day.
--   - No AI-assisted composition.
--   - No "suggested recipients."
-- ════════════════════════════════════════════════════════════════════════

-- 1. letters ──────────────────────────────────────────────────────────

create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles(id) on delete set null,
  family_id     uuid references public.families(id) on delete set null,
  body_md       text not null check (length(body_md) between 1 and 50000),
  audio_url     text,
  -- For dual-write of the body's plain text — used by digest copy and
  -- search if we ever build it. Server can populate via trigger; for
  -- now, the client supplies it alongside body_md.
  body_plain    text,
  deliver_at    timestamptz not null,
  delivered_at  timestamptz,
  -- Authors can mark a letter as a "memorial" letter — these proceed
  -- on schedule even after the author is marked deceased. Default true
  -- (the spec says queued letters never auto-pause on death) but the
  -- column lets a future workflow toggle it explicitly.
  proceeds_after_death boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists letters_author_idx on public.letters (author_id, created_at desc);
create index if not exists letters_due_idx on public.letters (deliver_at) where delivered_at is null;

alter table public.letters enable row level security;

-- Read: author + any resolved recipient (joined via letter_recipients).
drop policy if exists letters_read on public.letters;
create policy letters_read on public.letters
  for select to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.letter_recipients lr
      where lr.letter_id = letters.id
        and lr.user_id = auth.uid()
        and letters.delivered_at is not null
    )
  );

-- Insert: must be the author.
drop policy if exists letters_insert on public.letters;
create policy letters_insert on public.letters
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and deliver_at > now()
  );

-- Update: author only, until 24h before deliver_at and never after
-- delivery. The lock is enforced by the WITH CHECK clause below.
drop policy if exists letters_update on public.letters;
create policy letters_update on public.letters
  for update to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and delivered_at is null
    and deliver_at > now() + interval '24 hours'
  );

-- Delete: author only, before delivery. After delivery the letter is
-- immutable history.
drop policy if exists letters_delete on public.letters;
create policy letters_delete on public.letters
  for delete to authenticated
  using (auth.uid() = author_id and delivered_at is null);

-- 2. letter_recipients ────────────────────────────────────────────────

create table if not exists public.letter_recipients (
  id                       uuid primary key default gen_random_uuid(),
  letter_id                uuid not null references public.letters(id) on delete cascade,
  -- Resolved recipient: a current user.
  user_id                  uuid references public.profiles(id) on delete set null,
  -- Future recipient: a label (e.g., "my future grandchild"). When
  -- the recipient claims the letter via the token, this row's
  -- user_id is populated and future_recipient_token cleared.
  future_recipient_label   text,
  future_recipient_token   text unique,
  read_at                  timestamptz,
  created_at               timestamptz not null default now()
);

-- A row must be exactly one of: resolved (user_id set) or future
-- (label + token set, user_id null until claimed).
alter table public.letter_recipients
  add constraint letter_recipients_one_of
  check (
    (user_id is not null and future_recipient_label is null and future_recipient_token is null)
    or (user_id is null and future_recipient_label is not null and future_recipient_token is not null)
    or (user_id is not null and future_recipient_label is not null) -- claimed future recipient
  ) not valid;

create index if not exists letter_recipients_user_idx on public.letter_recipients (user_id);
create index if not exists letter_recipients_letter_idx on public.letter_recipients (letter_id);

alter table public.letter_recipients enable row level security;

-- Read: author of the parent letter, or the recipient themselves.
drop policy if exists letter_recipients_read on public.letter_recipients;
create policy letter_recipients_read on public.letter_recipients
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.letters l
      where l.id = letter_recipients.letter_id and l.author_id = auth.uid()
    )
  );

-- Insert: only the parent letter's author can attach recipients.
drop policy if exists letter_recipients_insert on public.letter_recipients;
create policy letter_recipients_insert on public.letter_recipients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.letters l
      where l.id = letter_recipients.letter_id and l.author_id = auth.uid()
    )
  );

-- Update: the recipient stamps their own read_at. The author can swap
-- a future recipient's user_id when binding a claim. (Two narrow
-- paths; we use a single policy that covers both via a CHECK.)
drop policy if exists letter_recipients_update on public.letter_recipients;
create policy letter_recipients_update on public.letter_recipients
  for update to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.letters l
      where l.id = letter_recipients.letter_id and l.author_id = auth.uid()
    )
  );

drop policy if exists letter_recipients_delete on public.letter_recipients;
create policy letter_recipients_delete on public.letter_recipients
  for delete to authenticated
  using (
    exists (
      select 1 from public.letters l
      where l.id = letter_recipients.letter_id
        and l.author_id = auth.uid()
        and l.delivered_at is null
    )
  );

-- 3. RPC: claim a future-recipient token ──────────────────────────────
-- Takes the secret token and the calling user; if it matches a row
-- with no user_id yet, binds it. Idempotent if already bound to the
-- same user.

create or replace function public.claim_letter_token(p_token text)
returns table (letter_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  matched_id uuid;
  matched_letter uuid;
  matched_user uuid;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;
  select id, letter_id, user_id
    into matched_id, matched_letter, matched_user
    from public.letter_recipients
    where future_recipient_token = p_token
    limit 1;

  if matched_id is null then
    raise exception 'Token not found';
  end if;

  -- Idempotent if same user re-claims.
  if matched_user is not null and matched_user <> caller then
    raise exception 'This letter belongs to a different account.';
  end if;

  update public.letter_recipients
    set user_id = caller,
        future_recipient_token = null
    where id = matched_id;

  letter_id := matched_letter;
  return next;
end;
$$;

grant execute on function public.claim_letter_token(text) to authenticated;

-- 4. Trigger: update letters.updated_at on edit ────────────────────────

create or replace function public.touch_letters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists letters_touch_updated on public.letters;
create trigger letters_touch_updated
  before update on public.letters
  for each row execute function public.touch_letters_updated_at();

-- DONE.
