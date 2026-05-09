-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 030: The Letter (Source of Truth, Milestone 5)
-- ════════════════════════════════════════════════════════════════════════
-- A Letter is a tweet's opposite: long, private, scheduled, addressed
-- to one person (or a future user not yet on the platform).
--
-- ORDERING: tables both first, then constraints, then policies. The
-- letters_read policy references letter_recipients and vice-versa, so
-- both must exist before any policy creation runs.
--
-- Refusal list (M5):
--   - No public letters.
--   - No featured letters / letter-of-the-day.
--   - No AI-assisted composition.
--   - No "suggested recipients."
-- ════════════════════════════════════════════════════════════════════════

-- 1. Tables ───────────────────────────────────────────────────────────

create table if not exists public.letters (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles(id) on delete set null,
  family_id     uuid references public.families(id) on delete set null,
  body_md       text not null check (length(body_md) between 1 and 50000),
  audio_url     text,
  body_plain    text,
  deliver_at    timestamptz not null,
  delivered_at  timestamptz,
  proceeds_after_death boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.letter_recipients (
  id                       uuid primary key default gen_random_uuid(),
  letter_id                uuid not null references public.letters(id) on delete cascade,
  user_id                  uuid references public.profiles(id) on delete set null,
  future_recipient_label   text,
  future_recipient_token   text unique,
  read_at                  timestamptz,
  created_at               timestamptz not null default now()
);

-- 2. Indexes + RLS enable ─────────────────────────────────────────────

create index if not exists letters_author_idx on public.letters (author_id, created_at desc);
create index if not exists letters_due_idx on public.letters (deliver_at) where delivered_at is null;
create index if not exists letter_recipients_user_idx on public.letter_recipients (user_id);
create index if not exists letter_recipients_letter_idx on public.letter_recipients (letter_id);

alter table public.letters enable row level security;
alter table public.letter_recipients enable row level security;

-- 3. Recipient row "exactly one of" constraint (idempotent) ───────────

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'letter_recipients_one_of'
  ) then
    alter table public.letter_recipients add constraint letter_recipients_one_of check (
      (user_id is not null and future_recipient_label is null and future_recipient_token is null)
      or (user_id is null and future_recipient_label is not null and future_recipient_token is not null)
      or (user_id is not null and future_recipient_label is not null)
    ) not valid;
  end if;
end $$;

-- 4. Policies — both tables exist now, no forward refs ────────────────

-- letters
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

drop policy if exists letters_insert on public.letters;
create policy letters_insert on public.letters
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and deliver_at > now()
  );

drop policy if exists letters_update on public.letters;
create policy letters_update on public.letters
  for update to authenticated
  using (auth.uid() = author_id)
  with check (
    auth.uid() = author_id
    and delivered_at is null
    and deliver_at > now() + interval '24 hours'
  );

drop policy if exists letters_delete on public.letters;
create policy letters_delete on public.letters
  for delete to authenticated
  using (auth.uid() = author_id and delivered_at is null);

-- letter_recipients
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

drop policy if exists letter_recipients_insert on public.letter_recipients;
create policy letter_recipients_insert on public.letter_recipients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.letters l
      where l.id = letter_recipients.letter_id and l.author_id = auth.uid()
    )
  );

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

-- 5. RPC: claim a future-recipient token ──────────────────────────────

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

-- 6. Trigger: bump letters.updated_at on edit ──────────────────────────

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
