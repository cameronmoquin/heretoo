-- ─────────────────────────────────────────────────────────────────────────
-- 015: Family groups (clean rebuild, branched from the working public feed)
-- ─────────────────────────────────────────────────────────────────────────
--
-- The previous candon_* attempt accumulated 9 layers of policies, helpers,
-- and inconsistencies that ended in unrecoverable RLS denials. This migration
-- starts over from the proven `posts` table pattern: simple, inline RLS, no
-- SECURITY DEFINER helpers, no orthogonal tables to keep in sync.
--
-- Approach:
--   - Two new tables: family_groups, family_members
--   - One new column on the EXISTING `posts` table: family_group_id
--     - NULL  → public post (current behavior, untouched)
--     - SET   → private to that family
--   - Replace `posts` SELECT/INSERT policies to handle both cases inline.
--     No helper functions; the policy reads family_members directly.
--   - Storage stays the same (post-photos bucket already works).
--
-- This means everything that ALREADY works for public posts — the composer,
-- upload flow, FeedList, image rendering, RLS — automatically works for
-- family posts too. The family screens are just the same UI with a filter.

-- ═══════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.family_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description     TEXT,
  motto           TEXT CHECK (motto IS NULL OR char_length(motto) <= 80),
  theme_primary   TEXT CHECK (theme_primary IS NULL OR theme_primary ~ '^#[0-9A-Fa-f]{6}$'),
  invite_code     TEXT UNIQUE NOT NULL DEFAULT upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  parent_group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_groups_invite_code ON family_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_family_groups_parent      ON family_groups(parent_group_id);

CREATE TABLE IF NOT EXISTS public.family_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user  ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_group ON family_members(family_group_id);

-- ═══════════════════════════════════════════════════════════════════════
-- EXTEND posts: add family_group_id (NULL = public, set = family-private)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS family_category TEXT CHECK (
    family_category IS NULL OR family_category IN ('general','medical','holiday','party','event')
  );

CREATE INDEX IF NOT EXISTS idx_posts_family_group ON posts(family_group_id, created_at DESC)
  WHERE family_group_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- AUTO-ADD OWNER ON GROUP CREATE
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.family_groups_add_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO family_members (family_group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_groups_owner_membership ON family_groups;
CREATE TRIGGER family_groups_owner_membership
  AFTER INSERT ON family_groups
  FOR EACH ROW EXECUTE FUNCTION family_groups_add_owner_membership();

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — INLINE MEMBERSHIP CHECKS (no helper functions to drift)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE family_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- ─── family_groups ────────────────────────────────────────────────────
DROP POLICY IF EXISTS family_groups_select ON family_groups;
CREATE POLICY family_groups_select
  ON family_groups FOR SELECT
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM family_members m
               WHERE m.family_group_id = family_groups.id
                 AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS family_groups_insert ON family_groups;
CREATE POLICY family_groups_insert
  ON family_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS family_groups_update ON family_groups;
CREATE POLICY family_groups_update
  ON family_groups FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM family_members m
               WHERE m.family_group_id = family_groups.id
                 AND m.user_id = auth.uid()
                 AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS family_groups_delete ON family_groups;
CREATE POLICY family_groups_delete
  ON family_groups FOR DELETE
  USING (auth.uid() = created_by);

-- ─── family_members ───────────────────────────────────────────────────
DROP POLICY IF EXISTS family_members_select ON family_members;
CREATE POLICY family_members_select
  ON family_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM family_members m2
               WHERE m2.family_group_id = family_members.family_group_id
                 AND m2.user_id = auth.uid())
  );

-- A user joins a group by inserting their own membership row.
-- The application layer validates the invite code before calling this.
DROP POLICY IF EXISTS family_members_insert ON family_members;
CREATE POLICY family_members_insert
  ON family_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS family_members_delete ON family_members;
CREATE POLICY family_members_delete
  ON family_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM family_groups g
               WHERE g.id = family_members.family_group_id
                 AND g.created_by = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
-- RLS — extend `posts` to gate family-tagged rows
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (
    family_group_id IS NULL
    OR EXISTS (SELECT 1 FROM family_members m
               WHERE m.family_group_id = posts.family_group_id
                 AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      family_group_id IS NULL
      OR EXISTS (SELECT 1 FROM family_members m
                 WHERE m.family_group_id = posts.family_group_id
                   AND m.user_id = auth.uid())
    )
  );

-- UPDATE / DELETE policies stay as-is from migration 006.

-- ═══════════════════════════════════════════════════════════════════════
-- ART RESERVOIR — persistent gallery + slots for ads
-- ═══════════════════════════════════════════════════════════════════════
-- A reservoir of curated art that surfaces in the feed (not tied to a post).
-- Each row is either:
--   - kind='art'  : a piece of art (uploaded by a user)
--   - kind='ad'   : an ad placement (revenue surface)
-- Both render through the same component slot in the UI ("large art panel"),
-- so HereToo never fully loses its art identity.

CREATE TABLE IF NOT EXISTS public.art_reservoir (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL CHECK (kind IN ('art','ad')),
  title           TEXT,
  caption         TEXT,
  image_url       TEXT NOT NULL,
  artist_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  artist_name     TEXT,
  -- For ads only:
  ad_advertiser   TEXT,
  ad_click_url    TEXT,
  ad_impressions  INTEGER NOT NULL DEFAULT 0,
  -- Display controls:
  weight          INTEGER NOT NULL DEFAULT 100,
  active          BOOLEAN NOT NULL DEFAULT true,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  -- Scope: NULL = global (all of HereToo), set = scoped to a family group
  family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  created_by      UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_art_reservoir_active
  ON art_reservoir(active, kind, weight DESC) WHERE active = true;

ALTER TABLE art_reservoir ENABLE ROW LEVEL SECURITY;

-- Anyone can view active art/ads (clients should still respect starts_at/ends_at)
DROP POLICY IF EXISTS art_reservoir_select ON art_reservoir;
CREATE POLICY art_reservoir_select
  ON art_reservoir FOR SELECT
  USING (
    active = true
    AND (
      family_group_id IS NULL
      OR EXISTS (SELECT 1 FROM family_members m
                 WHERE m.family_group_id = art_reservoir.family_group_id
                   AND m.user_id = auth.uid())
    )
  );

-- Authenticated users submit their own art. Ads come in via service role only.
DROP POLICY IF EXISTS art_reservoir_insert ON art_reservoir;
CREATE POLICY art_reservoir_insert
  ON art_reservoir FOR INSERT
  WITH CHECK (
    kind = 'art'
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS art_reservoir_update ON art_reservoir;
CREATE POLICY art_reservoir_update
  ON art_reservoir FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS art_reservoir_delete ON art_reservoir;
CREATE POLICY art_reservoir_delete
  ON art_reservoir FOR DELETE
  USING (auth.uid() = created_by);
