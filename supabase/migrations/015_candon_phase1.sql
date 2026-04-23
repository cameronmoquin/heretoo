-- Migration 015: Candon Phase 1 — Foundation
--
-- Private relationship-assistant + family-bulletin product.
-- Lives in the HereToo Supabase project, namespace-isolated.
-- Reuses auth.users. All tables prefixed "candon_" where there's
-- collision risk with HereToo; family/contacts tables are safe
-- because HereToo doesn't use those names.
--
-- Phase 1 scope: contacts, family groups, memberships. Nothing else.

-- ─── CANDON USER PROFILES (separate from HereToo profiles) ───
CREATE TABLE IF NOT EXISTS public.candon_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone_e164 TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  preferred_digest_time TIME DEFAULT '07:00',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER candon_user_profiles_updated_at
  BEFORE UPDATE ON candon_user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── CONTACTS ───
CREATE TABLE IF NOT EXISTS public.candon_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone_e164 TEXT,
  email TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'friend',
  outreach_mode TEXT NOT NULL DEFAULT 'personal'
    CHECK (outreach_mode IN ('personal','family','work','campaign')),
  -- Segmentation fields (used by hidden admin modes)
  organization TEXT,
  role_title TEXT,
  district TEXT,
  geography TEXT,
  volunteer_status TEXT,
  supporter_level TEXT,
  last_engagement_type TEXT,
  outreach_priority INT,
  -- Personal fields
  closeness_score INT NOT NULL DEFAULT 50,
  preferred_frequency_days INT NOT NULL DEFAULT 30,
  birthday DATE,
  tone_preference TEXT,
  manual_only BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER candon_contacts_updated_at
  BEFORE UPDATE ON candon_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_candon_contacts_user ON candon_contacts(user_id);
CREATE INDEX idx_candon_contacts_mode ON candon_contacts(user_id, outreach_mode);
CREATE INDEX idx_candon_contacts_name ON candon_contacts(user_id, display_name);

-- ─── CONTACT TAGS ───
CREATE TABLE IF NOT EXISTS public.candon_contact_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES candon_contacts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE (contact_id, tag)
);
CREATE INDEX idx_candon_contact_tags_contact ON candon_contact_tags(contact_id);

-- ─── FAMILY GROUPS ───
CREATE TABLE IF NOT EXISTS public.candon_family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_candon_family_groups_owner ON candon_family_groups(owner_user_id);

-- ─── FAMILY MEMBERSHIPS ───
CREATE TABLE IF NOT EXISTS public.candon_family_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES candon_family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner','admin','editor','member','medical_limited')),
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_group_id, user_id)
);
CREATE INDEX idx_candon_memberships_user ON candon_family_memberships(user_id);
CREATE INDEX idx_candon_memberships_group ON candon_family_memberships(family_group_id);

-- ─── HELPER FUNCTIONS ───
-- Is the current user a member of this family group?
CREATE OR REPLACE FUNCTION candon_is_family_member(p_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM candon_family_memberships
    WHERE family_group_id = p_group_id
      AND user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- What role does the current user have in this family group?
CREATE OR REPLACE FUNCTION candon_family_role(p_group_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM candon_family_memberships
  WHERE family_group_id = p_group_id
    AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ─── RLS ───
ALTER TABLE candon_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own candon profile"
  ON candon_user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own candon profile"
  ON candon_user_profiles FOR ALL USING (auth.uid() = user_id);

ALTER TABLE candon_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own contacts"
  ON candon_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own contacts"
  ON candon_contacts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE candon_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own contact tags"
  ON candon_contact_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM candon_contacts WHERE id = candon_contact_tags.contact_id AND user_id = auth.uid())
  );
CREATE POLICY "Users manage own contact tags"
  ON candon_contact_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM candon_contacts WHERE id = candon_contact_tags.contact_id AND user_id = auth.uid())
  );

ALTER TABLE candon_family_groups ENABLE ROW LEVEL SECURITY;
-- Can view group if you're a member
CREATE POLICY "Members view family group"
  ON candon_family_groups FOR SELECT
  USING (auth.uid() = owner_user_id OR candon_is_family_member(id));
-- Only owner can update/delete
CREATE POLICY "Owner creates family group"
  ON candon_family_groups FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owner manages family group"
  ON candon_family_groups FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owner deletes family group"
  ON candon_family_groups FOR DELETE USING (auth.uid() = owner_user_id);

ALTER TABLE candon_family_memberships ENABLE ROW LEVEL SECURITY;
-- You can see memberships for groups you belong to
CREATE POLICY "Members view memberships"
  ON candon_family_memberships FOR SELECT
  USING (user_id = auth.uid() OR candon_is_family_member(family_group_id));
-- You can join via accepting an invite (service role handles this typically,
-- but we allow self-insert when owner creates + invites)
CREATE POLICY "Users can join via invite"
  ON candon_family_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
-- Owner can manage all memberships; members can leave themselves
CREATE POLICY "Owner manages memberships"
  ON candon_family_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_groups
      WHERE id = candon_family_memberships.family_group_id
        AND owner_user_id = auth.uid()
    )
  );
CREATE POLICY "Users can leave groups"
  ON candon_family_memberships FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM candon_family_groups
      WHERE id = candon_family_memberships.family_group_id
        AND owner_user_id = auth.uid()
    )
  );

-- ─── AUTO-ADD OWNER AS MEMBER ON GROUP CREATE ───
CREATE OR REPLACE FUNCTION candon_auto_add_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO candon_family_memberships (family_group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER candon_family_group_owner_membership
  AFTER INSERT ON candon_family_groups
  FOR EACH ROW EXECUTE FUNCTION candon_auto_add_owner_membership();
