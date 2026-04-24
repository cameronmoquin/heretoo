-- Migration 017: Candon Phase 3 — Medical updates, scoped visibility, audit, inbound email

-- ─── EXTEND POSTS: add medical type + visibility scope ───
-- post_type: add 'medical_update'
ALTER TABLE candon_family_posts DROP CONSTRAINT IF EXISTS candon_family_posts_post_type_check;
ALTER TABLE candon_family_posts ADD CONSTRAINT candon_family_posts_post_type_check
  CHECK (post_type IN ('general_update','event','assignment','reminder','medical_update'));

-- sensitivity: add 'medical'
ALTER TABLE candon_family_posts DROP CONSTRAINT IF EXISTS candon_family_posts_sensitivity_check;
ALTER TABLE candon_family_posts ADD CONSTRAINT candon_family_posts_sensitivity_check
  CHECK (sensitivity IN ('normal','private','medical'));

-- visibility_scope column
ALTER TABLE candon_family_posts ADD COLUMN IF NOT EXISTS visibility_scope TEXT
  NOT NULL DEFAULT 'group'
  CHECK (visibility_scope IN ('group','selected_members','admins_only','medical_limited'));

-- ─── POST RECIPIENTS (for selected_members and medical_limited scopes) ───
CREATE TABLE IF NOT EXISTS public.candon_family_post_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID NOT NULL REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_post_id, user_id)
);

CREATE INDEX idx_candon_post_recipients_post ON candon_family_post_recipients(family_post_id);
CREATE INDEX idx_candon_post_recipients_user ON candon_family_post_recipients(user_id);

-- ─── MEDICAL UPDATE DETAILS (subtype) ───
CREATE TABLE IF NOT EXISTS public.candon_family_medical_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID NOT NULL UNIQUE REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  patient_label TEXT NOT NULL,
  status_level TEXT NOT NULL DEFAULT 'stable'
    CHECK (status_level IN ('stable','monitoring','concerning','critical','improving','recovering','passed')),
  care_location TEXT,
  help_needed TEXT,
  contact_person TEXT,
  next_update_expected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candon_medical_post ON candon_family_medical_updates(family_post_id);

-- ─── AUDIT LOG FOR SENSITIVE POST VIEWS ───
CREATE TABLE IF NOT EXISTS public.candon_post_view_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID NOT NULL REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candon_view_log_post ON candon_post_view_log(family_post_id, viewed_at DESC);
CREATE INDEX idx_candon_view_log_user ON candon_post_view_log(user_id, viewed_at DESC);

-- ─── INBOUND EMAILS (from Resend webhook) ───
CREATE TABLE IF NOT EXISTS public.candon_inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT UNIQUE,
  from_address TEXT,
  to_addresses TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  headers JSONB,
  body_text TEXT,
  body_html TEXT,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- link to what this email is a reply to
  family_group_id UUID REFERENCES candon_family_groups(id) ON DELETE SET NULL,
  family_post_id UUID REFERENCES candon_family_posts(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candon_inbound_group ON candon_inbound_emails(family_group_id, received_at DESC);
CREATE INDEX idx_candon_inbound_post ON candon_inbound_emails(family_post_id, received_at DESC);

-- ─── HELPER: can the current user view this post? ───
-- Respects visibility_scope: group | selected_members | admins_only | medical_limited
CREATE OR REPLACE FUNCTION candon_can_view_post(p_post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_group UUID;
  v_scope TEXT;
  v_author UUID;
  v_role TEXT;
BEGIN
  SELECT family_group_id, visibility_scope, created_by
    INTO v_group, v_scope, v_author
  FROM candon_family_posts
  WHERE id = p_post_id;

  -- Not a member of the group: no.
  IF NOT candon_is_family_member(v_group) THEN
    RETURN FALSE;
  END IF;

  -- Author always sees their own.
  IF v_author = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Whole group scope: member sees it.
  IF v_scope = 'group' THEN
    RETURN TRUE;
  END IF;

  v_role := candon_family_role(v_group);

  -- Admin-only scope: owner/admin only.
  IF v_scope = 'admins_only' THEN
    RETURN v_role IN ('owner','admin');
  END IF;

  -- Selected or medical_limited: recipient listed OR owner/admin.
  IF v_scope IN ('selected_members','medical_limited') THEN
    RETURN v_role IN ('owner','admin') OR EXISTS (
      SELECT 1 FROM candon_family_post_recipients
      WHERE family_post_id = p_post_id AND user_id = auth.uid()
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── REPLACE OLD "Members view family posts" POLICY WITH SCOPED ONE ───
DROP POLICY IF EXISTS "Members view family posts" ON candon_family_posts;
CREATE POLICY "Members view family posts by scope"
  ON candon_family_posts FOR SELECT
  USING (candon_can_view_post(id));

-- Update rsvp/assignment view policies to respect scope too
DROP POLICY IF EXISTS "Members view events" ON candon_family_events;
CREATE POLICY "Members view events by scope"
  ON candon_family_events FOR SELECT
  USING (candon_can_view_post(family_post_id));

DROP POLICY IF EXISTS "Members view rsvps" ON candon_event_rsvps;
CREATE POLICY "Members view rsvps by scope"
  ON candon_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_events e
      WHERE e.id = candon_event_rsvps.event_id
      AND candon_can_view_post(e.family_post_id)
    )
  );

DROP POLICY IF EXISTS "Members view assignments" ON candon_family_assignments;
CREATE POLICY "Members view assignments by scope"
  ON candon_family_assignments FOR SELECT
  USING (
    (family_post_id IS NOT NULL AND candon_can_view_post(family_post_id))
    OR
    (family_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_events e
      WHERE e.id = candon_family_assignments.family_event_id
      AND candon_can_view_post(e.family_post_id)
    ))
  );

-- ─── RLS ON NEW TABLES ───
ALTER TABLE candon_family_post_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view recipient lists"
  ON candon_family_post_recipients FOR SELECT
  USING (candon_can_view_post(family_post_id));
CREATE POLICY "Author adds recipients"
  ON candon_family_post_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_post_recipients.family_post_id
      AND created_by = auth.uid()
    )
  );
CREATE POLICY "Author removes recipients"
  ON candon_family_post_recipients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_post_recipients.family_post_id
      AND created_by = auth.uid()
    )
  );

ALTER TABLE candon_family_medical_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view medical by scope"
  ON candon_family_medical_updates FOR SELECT
  USING (candon_can_view_post(family_post_id));
CREATE POLICY "Author manages medical"
  ON candon_family_medical_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_medical_updates.family_post_id
      AND created_by = auth.uid()
    )
  );

ALTER TABLE candon_post_view_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users log own views"
  ON candon_post_view_log FOR INSERT
  WITH CHECK (user_id = auth.uid());
-- Post authors see who viewed (for sensitive posts)
CREATE POLICY "Author sees view log"
  ON candon_post_view_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_post_view_log.family_post_id
      AND created_by = auth.uid()
    )
  );

ALTER TABLE candon_inbound_emails ENABLE ROW LEVEL SECURITY;
-- Only group members can view inbound emails tied to their group
CREATE POLICY "Members view inbound emails"
  ON candon_inbound_emails FOR SELECT
  USING (
    family_group_id IS NOT NULL
    AND candon_is_family_member(family_group_id)
  );

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE candon_family_post_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE candon_family_medical_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE candon_inbound_emails;
