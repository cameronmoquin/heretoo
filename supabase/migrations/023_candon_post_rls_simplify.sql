-- ─────────────────────────────────────────────────────────────────────────
-- 023: Simplify candon_family_posts INSERT RLS
-- ─────────────────────────────────────────────────────────────────────────
-- Until now, the policy required (created_by = auth.uid() AND
-- candon_is_family_member(family_group_id)). The client had to send
-- created_by, and any drift between the auth store and the JWT.sub caused
-- silent 42501 RLS denials that were nearly impossible to diagnose.
--
-- This migration:
--   1. Makes `created_by` default to `auth.uid()` so the client doesn't
--      need to send it. The DB always fills it in from the JWT.
--   2. Replaces the INSERT policy to only check membership. The created_by
--      value is implicitly trusted because the DB defaults it to auth.uid()
--      and the WITH CHECK still enforces created_by = auth.uid() defensively.

-- 1. Default created_by to auth.uid() (no-op for inserts that already set it)
ALTER TABLE candon_family_posts
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Replace the INSERT policy with a defensive but tolerant check
DROP POLICY IF EXISTS "Members create posts" ON candon_family_posts;
CREATE POLICY "Members create posts"
  ON candon_family_posts FOR INSERT
  WITH CHECK (
    -- Author must be the current user (DB default ensures this is true
    -- even when the client doesn't pass created_by)
    created_by = auth.uid()
    -- Author must be a member of the target family group
    AND candon_is_family_member(family_group_id)
  );
