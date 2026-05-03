-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 019: recipient-selectable family updates
-- ════════════════════════════════════════════════════════════════════════
-- Closes one of the original-pitch promises: "isolated family updates
-- that can choose specific family members to receive the updates (like
-- for health emergency updates in the family — the origin of this
-- platform)".
--
-- Until now, post.kind='update' was just a UI flag — it broadcast to
-- the whole family same as a regular family post. This migration adds
-- a real recipient list and tightens the RLS policy so a recipient-
-- restricted update is genuinely visible only to the listed members
-- (plus the author, of course).
--
-- Schema:
--   - posts.update_recipient_ids uuid[]    nullable
--     - NULL  → broadcast to whole family (existing behavior)
--     - empty array {} → also broadcast (treated as NULL)
--     - non-empty array → ONLY these profiles + the author can read
--
-- RLS: extend the family-scope branch to also check the recipient list
-- when present. Policy is rewritten as a single CREATE POLICY (Postgres
-- doesn't allow ALTER POLICY for USING expressions).
-- ════════════════════════════════════════════════════════════════════════

alter table public.posts
  add column if not exists update_recipient_ids uuid[];

-- Replace posts_read with a version that respects the recipient list.
-- Same logic as migration 003 except the family branch now also gates
-- on update_recipient_ids when it's non-empty.
drop policy if exists posts_read on public.posts;

create policy posts_read on public.posts
  for select to authenticated using (
    -- Self-read: authors always see their own posts (including drafts
    -- and recipient-restricted updates they sent)
    auth.uid() = author_id

    -- Public posts: anyone signed in
    or visibility = 'public'

    -- Family-scoped: must be active member of the post's family
    -- AND if the post is a recipient-restricted update, must be in
    -- the recipient list.
    or (visibility = 'family' and family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = posts.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    ) and (
      -- Either no recipient restriction in effect:
      posts.update_recipient_ids is null
      or array_length(posts.update_recipient_ids, 1) is null
      -- Or the viewer is on the recipient list:
      or auth.uid() = any(posts.update_recipient_ids)
    ))

    -- Connections-scoped: viewer is in the author's family network OR
    -- has an explicit accepted connection.
    or (visibility = 'connections' and (
      author_id in (
        select profile_id from public.family_network_reach(auth.uid(), 3)
      )
      or exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.requester_id = auth.uid() and c.recipient_id = posts.author_id)
            or (c.recipient_id = auth.uid() and c.requester_id = posts.author_id))
      )
    ))
  );

-- DONE.
