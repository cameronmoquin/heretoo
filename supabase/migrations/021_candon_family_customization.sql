-- ─────────────────────────────────────────────────────────────────────────
-- 021: Per-family customization (motto, theme color, crest overrides)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE candon_family_groups
  ADD COLUMN IF NOT EXISTS motto TEXT,
  ADD COLUMN IF NOT EXISTS theme_primary TEXT,        -- hex, e.g. '#4A6B4A'
  ADD COLUMN IF NOT EXISTS crest_palette_index INT,   -- 0..7, see lib/family-crest.ts PALETTES
  ADD COLUMN IF NOT EXISTS crest_division TEXT,       -- 'plain'|'per-pale'|'per-fess'|'per-bend'|'per-bend-sinister'|'quartered'|'chief'
  ADD COLUMN IF NOT EXISTS crest_charge TEXT;         -- 'chevron'|'cross'|... (see CHARGES)

-- Length / format guards (best-effort; client should validate too).
ALTER TABLE candon_family_groups
  DROP CONSTRAINT IF EXISTS candon_family_groups_motto_length;
ALTER TABLE candon_family_groups
  ADD  CONSTRAINT candon_family_groups_motto_length CHECK (motto IS NULL OR char_length(motto) <= 80);

ALTER TABLE candon_family_groups
  DROP CONSTRAINT IF EXISTS candon_family_groups_theme_primary_format;
ALTER TABLE candon_family_groups
  ADD  CONSTRAINT candon_family_groups_theme_primary_format
    CHECK (theme_primary IS NULL OR theme_primary ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE candon_family_groups
  DROP CONSTRAINT IF EXISTS candon_family_groups_crest_palette_range;
ALTER TABLE candon_family_groups
  ADD  CONSTRAINT candon_family_groups_crest_palette_range
    CHECK (crest_palette_index IS NULL OR (crest_palette_index >= 0 AND crest_palette_index <= 31));

-- ─── RLS: who can edit customization ───
-- Replace the existing UPDATE policy on candon_family_groups so admins
-- (not just the owner) can change cosmetic fields.
DROP POLICY IF EXISTS "Owner manages family group" ON candon_family_groups;
CREATE POLICY "Owner or admin updates family group"
  ON candon_family_groups FOR UPDATE
  USING (
    auth.uid() = owner_user_id
    OR EXISTS (
      SELECT 1 FROM candon_family_memberships m
      WHERE m.family_group_id = id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );
