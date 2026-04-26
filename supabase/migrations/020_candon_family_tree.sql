-- ─────────────────────────────────────────────────────────────────────────
-- 020: Family-tree topology
-- ─────────────────────────────────────────────────────────────────────────
-- Every new family must be spawned from inside an existing one (member
-- of the parent), creating an organic invitation-based propagation tree.
-- The very first families per Supabase project are roots (parent = NULL)
-- and need an admin/seed bootstrap (no app UI for root creation).

-- ─── COLUMNS ───
ALTER TABLE candon_family_groups
  ADD COLUMN IF NOT EXISTS parent_family_group_id UUID REFERENCES candon_family_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS spawned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candon_family_groups_parent
  ON candon_family_groups(parent_family_group_id);

-- ─── RLS UPDATE ON candon_family_groups ───
-- Replace the existing INSERT policy with one that requires either:
--   (a) parent_family_group_id IS NULL  (root — kept open here; UI restricts
--       to first-time users so we don't proliferate roots, and we can
--       tighten later by checking !EXISTS(member rows for this user)), OR
--   (b) the creator is a member of the parent group (the propagation rule)
DROP POLICY IF EXISTS "Owner creates family group" ON candon_family_groups;
CREATE POLICY "Owner creates family group"
  ON candon_family_groups FOR INSERT
  WITH CHECK (
    auth.uid() = owner_user_id
    AND (
      parent_family_group_id IS NULL
      OR candon_is_family_member(parent_family_group_id)
    )
  );

-- ─── BACKFILL spawned_by_user_id FOR EXISTING ROWS ───
-- Treat the owner as the spawner for any pre-existing rows.
UPDATE candon_family_groups
SET spawned_by_user_id = owner_user_id
WHERE spawned_by_user_id IS NULL;

-- ─── NETWORK STATS RPC ───
-- Public, non-private aggregate stats. Anyone signed in can call; only
-- counts and shape are exposed, never names or content.
CREATE OR REPLACE FUNCTION public.get_candon_network_stats()
RETURNS TABLE (
  total_families      BIGINT,
  total_root_trees    BIGINT,
  total_members       BIGINT,
  largest_tree_size   BIGINT,
  deepest_tree_depth  INTEGER,
  families_last_7d    BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE
    -- Walk every group from each root to label its tree id + depth
    tree AS (
      SELECT
        id,
        id AS root_id,
        0  AS depth
      FROM candon_family_groups
      WHERE parent_family_group_id IS NULL

      UNION ALL

      SELECT
        g.id,
        t.root_id,
        t.depth + 1
      FROM candon_family_groups g
      JOIN tree t ON g.parent_family_group_id = t.id
    ),
    tree_sizes AS (
      SELECT root_id, COUNT(*) AS size, MAX(depth) AS depth
      FROM tree
      GROUP BY root_id
    )
  SELECT
    (SELECT COUNT(*) FROM candon_family_groups)                                          AS total_families,
    (SELECT COUNT(*) FROM candon_family_groups WHERE parent_family_group_id IS NULL)     AS total_root_trees,
    (SELECT COUNT(*) FROM candon_family_memberships)                                     AS total_members,
    COALESCE((SELECT MAX(size)::BIGINT  FROM tree_sizes), 0)                             AS largest_tree_size,
    COALESCE((SELECT MAX(depth)        FROM tree_sizes), 0)                              AS deepest_tree_depth,
    (SELECT COUNT(*) FROM candon_family_groups
       WHERE created_at >= NOW() - INTERVAL '7 days')                                    AS families_last_7d;
$$;

GRANT EXECUTE ON FUNCTION public.get_candon_network_stats() TO authenticated, anon;

-- ─── ANCESTRY HELPER (for UI breadcrumbs) ───
-- Returns the path from a group up to its root, ordered root-first.
CREATE OR REPLACE FUNCTION public.candon_family_ancestry(p_group_id UUID)
RETURNS TABLE (id UUID, name TEXT, depth INTEGER)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT g.id, g.name, g.parent_family_group_id, 0 AS depth
    FROM candon_family_groups g
    WHERE g.id = p_group_id

    UNION ALL

    SELECT g.id, g.name, g.parent_family_group_id, c.depth + 1
    FROM candon_family_groups g
    JOIN chain c ON g.id = c.parent_family_group_id
  )
  SELECT id, name, depth FROM chain ORDER BY depth DESC;
$$;

GRANT EXECUTE ON FUNCTION public.candon_family_ancestry(UUID) TO authenticated;
