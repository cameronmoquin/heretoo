-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 021: family group chat
-- ════════════════════════════════════════════════════════════════════════
-- Adds a group chat room scoped to each family. Lives ALONGSIDE the
-- existing 1:1 message_threads infrastructure rather than replacing it
-- because:
--   - 1:1 threads have approval gating (in-network vs pending) that
--     doesn't apply to family chat (every active family member is
--     trusted by definition).
--   - Touching the existing messages_send RLS risks regressing
--     migration 015's recursion fix.
--   - One row per family for the chat container makes the "open the
--     family chat" lookup a single eq() instead of a membership scan.
--
-- Schema:
--   family_chats              one row per family
--     - id              uuid primary key
--     - family_id       uuid unique, FK to families, cascades
--     - created_at
--
--   family_chat_messages      messages in those rooms
--     - id              uuid primary key
--     - family_chat_id  FK
--     - sender_id       FK profiles
--     - body            text
--     - created_at
--
-- RLS: only active members of the chat's family can read or post.
-- Membership is checked against family_members.status='active'.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.family_chats (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null unique references public.families(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.family_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  family_chat_id  uuid not null references public.family_chats(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(body) > 0 and char_length(body) <= 4000),
  created_at      timestamptz not null default now()
);

create index if not exists family_chat_messages_chat_created_idx
  on public.family_chat_messages(family_chat_id, created_at desc);

alter table public.family_chats enable row level security;
alter table public.family_chat_messages enable row level security;

-- ── family_chats RLS ──────────────────────────────────────────────────

drop policy if exists family_chats_read on public.family_chats;
create policy family_chats_read on public.family_chats
  for select to authenticated using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_chats.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists family_chats_insert on public.family_chats;
create policy family_chats_insert on public.family_chats
  for insert to authenticated with check (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_chats.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- ── family_chat_messages RLS ──────────────────────────────────────────

drop policy if exists fcm_read on public.family_chat_messages;
create policy fcm_read on public.family_chat_messages
  for select to authenticated using (
    exists (
      select 1 from public.family_chats fc
      join public.family_members fm on fm.family_id = fc.family_id
      where fc.id = family_chat_messages.family_chat_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists fcm_send on public.family_chat_messages;
create policy fcm_send on public.family_chat_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.family_chats fc
      join public.family_members fm on fm.family_id = fc.family_id
      where fc.id = family_chat_messages.family_chat_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- DONE.
