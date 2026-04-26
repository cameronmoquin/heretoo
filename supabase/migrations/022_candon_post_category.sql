-- ─────────────────────────────────────────────────────────────────────────
-- 022: Post category (for tabbed family feed)
-- ─────────────────────────────────────────────────────────────────────────
-- Categories let the family feed split into All / Medical / Holidays /
-- Parties / Events while keeping every post in the same `candon_family_posts`
-- table. The `post_type` column controls *what kind of post* (text, event,
-- assignment, medical), while `category` controls *which feed tab* it lives
-- in. They are intentionally orthogonal — a Holiday tab can hold general
-- updates, sign-up sheets, AND events all in one place.

ALTER TABLE candon_family_posts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'medical', 'holiday', 'party', 'event'));

-- Backfill: medical posts get medical category; events get event category.
UPDATE candon_family_posts
SET category = 'medical'
WHERE post_type = 'medical_update' AND category = 'general';

UPDATE candon_family_posts
SET category = 'event'
WHERE post_type = 'event' AND category = 'general';

CREATE INDEX IF NOT EXISTS idx_candon_posts_category
  ON candon_family_posts(family_group_id, category, created_at DESC);
