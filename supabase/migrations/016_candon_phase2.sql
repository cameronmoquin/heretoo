-- Migration 016: Candon Phase 2 — Posts, Events, Assignments, RSVPs

-- ─── FAMILY POSTS ───
CREATE TABLE IF NOT EXISTS public.candon_family_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES candon_family_groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('general_update','event','assignment','reminder')),
  title TEXT NOT NULL,
  body TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity IN ('normal','private')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER candon_family_posts_updated_at
  BEFORE UPDATE ON candon_family_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_candon_posts_group ON candon_family_posts(family_group_id, created_at DESC);
CREATE INDEX idx_candon_posts_type ON candon_family_posts(family_group_id, post_type);

-- ─── EVENT DETAILS (subtype) ───
CREATE TABLE IF NOT EXISTS public.candon_family_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID NOT NULL UNIQUE REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  location_name TEXT,
  location_address TEXT,
  rsvp_deadline TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candon_events_post ON candon_family_events(family_post_id);
CREATE INDEX idx_candon_events_start ON candon_family_events(start_at);

-- ─── RSVPS ───
CREATE TABLE IF NOT EXISTS public.candon_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES candon_family_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('yes','no','maybe')),
  plus_count INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TRIGGER candon_event_rsvps_updated_at
  BEFORE UPDATE ON candon_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_candon_rsvps_event ON candon_event_rsvps(event_id);
CREATE INDEX idx_candon_rsvps_user ON candon_event_rsvps(user_id);

-- ─── ASSIGNMENTS (food, tasks, rides) ───
CREATE TABLE IF NOT EXISTS public.candon_family_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  family_event_id UUID REFERENCES candon_family_events(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'item' CHECK (assignment_type IN ('item','task','ride','food','other')),
  label TEXT NOT NULL,
  quantity_needed INT NOT NULL DEFAULT 1,
  claimed_by_user_id UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','complete')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (family_post_id IS NOT NULL OR family_event_id IS NOT NULL)
);

CREATE INDEX idx_candon_assignments_post ON candon_family_assignments(family_post_id);
CREATE INDEX idx_candon_assignments_event ON candon_family_assignments(family_event_id);
CREATE INDEX idx_candon_assignments_user ON candon_family_assignments(claimed_by_user_id);

-- ─── POST ACKNOWLEDGEMENTS ───
CREATE TABLE IF NOT EXISTS public.candon_post_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_post_id UUID NOT NULL REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_post_id, user_id)
);

CREATE INDEX idx_candon_acks_post ON candon_post_acknowledgements(family_post_id);

-- ─── NOTIFICATION JOBS (for email bulletins) ───
CREATE TABLE IF NOT EXISTS public.candon_notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  family_group_id UUID REFERENCES candon_family_groups(id) ON DELETE CASCADE,
  family_post_id UUID REFERENCES candon_family_posts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','push','digest')),
  template_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','failed','cancelled')),
  scheduled_for TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_candon_notif_status ON candon_notification_jobs(status, scheduled_for);
CREATE INDEX idx_candon_notif_user ON candon_notification_jobs(user_id, created_at DESC);

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE candon_family_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE candon_event_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE candon_family_assignments;

-- ─── RLS ───
ALTER TABLE candon_family_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view family posts"
  ON candon_family_posts FOR SELECT
  USING (candon_is_family_member(family_group_id));
CREATE POLICY "Members create posts"
  ON candon_family_posts FOR INSERT
  WITH CHECK (created_by = auth.uid() AND candon_is_family_member(family_group_id));
CREATE POLICY "Author edits own post"
  ON candon_family_posts FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "Author deletes own post"
  ON candon_family_posts FOR DELETE
  USING (created_by = auth.uid());

ALTER TABLE candon_family_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view events"
  ON candon_family_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_events.family_post_id
      AND candon_is_family_member(family_group_id)
    )
  );
CREATE POLICY "Post author manages event"
  ON candon_family_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_events.family_post_id
      AND created_by = auth.uid()
    )
  );

ALTER TABLE candon_event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view rsvps"
  ON candon_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_events e
      JOIN candon_family_posts p ON p.id = e.family_post_id
      WHERE e.id = candon_event_rsvps.event_id
      AND candon_is_family_member(p.family_group_id)
    )
  );
CREATE POLICY "Users manage own rsvp"
  ON candon_event_rsvps FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE candon_family_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view assignments"
  ON candon_family_assignments FOR SELECT
  USING (
    (family_post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_assignments.family_post_id
      AND candon_is_family_member(family_group_id)
    ))
    OR
    (family_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_events e
      JOIN candon_family_posts p ON p.id = e.family_post_id
      WHERE e.id = candon_family_assignments.family_event_id
      AND candon_is_family_member(p.family_group_id)
    ))
  );
CREATE POLICY "Post author creates assignments"
  ON candon_family_assignments FOR INSERT
  WITH CHECK (
    (family_post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_assignments.family_post_id
      AND created_by = auth.uid()
    ))
    OR
    (family_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_events e
      JOIN candon_family_posts p ON p.id = e.family_post_id
      WHERE e.id = candon_family_assignments.family_event_id
      AND p.created_by = auth.uid()
    ))
  );
CREATE POLICY "Members claim assignments"
  ON candon_family_assignments FOR UPDATE
  USING (
    -- must be a member to interact at all
    (family_post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_family_assignments.family_post_id
      AND candon_is_family_member(family_group_id)
    ))
    OR
    (family_event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM candon_family_events e
      JOIN candon_family_posts p ON p.id = e.family_post_id
      WHERE e.id = candon_family_assignments.family_event_id
      AND candon_is_family_member(p.family_group_id)
    ))
  );

ALTER TABLE candon_post_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view acks"
  ON candon_post_acknowledgements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM candon_family_posts
      WHERE id = candon_post_acknowledgements.family_post_id
      AND candon_is_family_member(family_group_id)
    )
  );
CREATE POLICY "Users ack own"
  ON candon_post_acknowledgements FOR INSERT
  WITH CHECK (user_id = auth.uid());

ALTER TABLE candon_notification_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications"
  ON candon_notification_jobs FOR SELECT
  USING (user_id = auth.uid());
