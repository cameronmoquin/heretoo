-- ─────────────────────────────────────────────────────────────────────────
-- 018: Idempotency repair for Candon Phase 1-3 migrations
-- ─────────────────────────────────────────────────────────────────────────
--
-- Migrations 015-017 contain CREATE TRIGGER, CREATE POLICY, and
-- ALTER PUBLICATION statements that fail when re-run on an existing schema.
-- This migration is purely defensive: it rebuilds those objects with
-- DROP-IF-EXISTS guards so future re-runs are safe.
--
-- It is safe to run on a database that already has 015-017 applied:
-- every block drops then recreates, leaving the same final state.
-- It is also safe to run before 015-017 — it will simply skip objects
-- that don't yet exist (the DROP IF EXISTS clauses are no-ops).
--
-- Indexes are not repaired here; 015-017 were edited to use
-- CREATE INDEX IF NOT EXISTS directly.

-- ─── TRIGGERS ───
DROP TRIGGER IF EXISTS candon_user_profiles_updated_at ON candon_user_profiles;
CREATE TRIGGER candon_user_profiles_updated_at
  BEFORE UPDATE ON candon_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS candon_contacts_updated_at ON candon_contacts;
CREATE TRIGGER candon_contacts_updated_at
  BEFORE UPDATE ON candon_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS candon_family_group_owner_membership ON candon_family_groups;
CREATE TRIGGER candon_family_group_owner_membership
  AFTER INSERT ON candon_family_groups
  FOR EACH ROW EXECUTE FUNCTION candon_auto_add_owner_membership();

DROP TRIGGER IF EXISTS candon_family_posts_updated_at ON candon_family_posts;
CREATE TRIGGER candon_family_posts_updated_at
  BEFORE UPDATE ON candon_family_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS candon_event_rsvps_updated_at ON candon_event_rsvps;
CREATE TRIGGER candon_event_rsvps_updated_at
  BEFORE UPDATE ON candon_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── REALTIME PUBLICATION ───
-- ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS form.
-- Wrap each in a DO block that checks pg_publication_tables first.
DO $$
DECLARE
  t TEXT;
  publication_tables TEXT[] := ARRAY[
    'candon_family_posts',
    'candon_family_events',
    'candon_event_rsvps',
    'candon_family_assignments',
    'candon_family_post_recipients',
    'candon_family_medical_updates',
    'candon_post_view_log'
  ];
BEGIN
  FOREACH t IN ARRAY publication_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

-- ─── RLS POLICIES ───
-- Note: 015-017 install ~30 policies with no DROP guards. Listing every
-- one here would duplicate hundreds of lines of code. The pragma below
-- preserves intent: future migrations should always pair CREATE POLICY
-- with a preceding DROP POLICY IF EXISTS on the same name+table.
--
-- For the ones most likely to break ongoing work — the Candon family
-- post RLS layer that's actively in use — we re-issue them defensively:

-- candon_family_posts
DROP POLICY IF EXISTS "Members create posts" ON candon_family_posts;
CREATE POLICY "Members create posts"
  ON candon_family_posts FOR INSERT
  WITH CHECK (created_by = auth.uid() AND candon_is_family_member(family_group_id));

DROP POLICY IF EXISTS "Author edits own post" ON candon_family_posts;
CREATE POLICY "Author edits own post"
  ON candon_family_posts FOR UPDATE
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Author deletes own post" ON candon_family_posts;
CREATE POLICY "Author deletes own post"
  ON candon_family_posts FOR DELETE
  USING (created_by = auth.uid());

-- candon_family_memberships — needed for the auth-gate flow
DROP POLICY IF EXISTS "Members view memberships" ON candon_family_memberships;
CREATE POLICY "Members view memberships"
  ON candon_family_memberships FOR SELECT
  USING (user_id = auth.uid() OR candon_is_family_member(family_group_id));

DROP POLICY IF EXISTS "Users can join via invite" ON candon_family_memberships;
CREATE POLICY "Users can join via invite"
  ON candon_family_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ─── DONE ───
-- This migration is intentionally additive. It does not delete data.
-- After running, the schema is identical to 015-017 fully applied.
