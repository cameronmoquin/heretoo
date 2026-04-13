-- Migration 001: Auth & Profiles

CREATE TABLE public.clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_color TEXT NOT NULL,
  description TEXT
);

INSERT INTO clusters (name, display_color) VALUES
  ('pragmatic_center', '#6B7280'),
  ('community_focused', '#3B82F6'),
  ('tradition_minded', '#92400E'),
  ('reform_oriented', '#10B981'),
  ('liberty_focused', '#F59E0B'),
  ('unclassified', '#D1D5DB');

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  birth_year INTEGER,
  location_region TEXT,
  origin_story TEXT,
  trust_score DECIMAL DEFAULT 0.0,
  cluster_id INTEGER REFERENCES clusters(id) DEFAULT 6,
  cluster_confidence DECIMAL DEFAULT 0.0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Migration 002: Posts & Media

CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_type TEXT CHECK (media_type IN ('none', 'photo', 'video')) DEFAULT 'none',

  -- Photos stored in Supabase Storage
  photo_urls TEXT[],

  -- Video stored via Mux
  mux_asset_id TEXT,
  mux_playback_id TEXT,
  mux_thumbnail_url TEXT,
  video_duration_seconds INTEGER,

  -- Bridging metrics (recalculated async)
  bridging_score DECIMAL DEFAULT 0.0,
  total_engagements INTEGER DEFAULT 0,
  cluster_reach INTEGER DEFAULT 0,
  cross_cluster_ratio DECIMAL DEFAULT 0.0,

  topic_tags TEXT[],
  is_position BOOLEAN DEFAULT FALSE,
  position_claim TEXT,
  position_evidence_url TEXT,
  position_steelman TEXT,
  position_common_ground TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE public.engagements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  engagement_type TEXT CHECK (
    engagement_type IN ('agree', 'disagree', 'important', 'share', 'bridge')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id, engagement_type)
);

CREATE INDEX idx_posts_bridging_score ON posts(bridging_score DESC);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_engagements_post_id ON engagements(post_id);
CREATE INDEX idx_engagements_user_id ON engagements(user_id);
-- Migration 003: Pulse Topics

CREATE TABLE public.pulse_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE public.pulse_statements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES pulse_topics(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  submitted_by UUID REFERENCES profiles(id),
  agree_count INTEGER DEFAULT 0,
  disagree_count INTEGER DEFAULT 0,
  pass_count INTEGER DEFAULT 0,
  bridging_score DECIMAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.pulse_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id UUID REFERENCES pulse_statements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('agree', 'disagree', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(statement_id, user_id)
);

CREATE INDEX idx_pulse_statements_topic ON pulse_statements(topic_id);
CREATE INDEX idx_pulse_votes_statement ON pulse_votes(statement_id);
CREATE INDEX idx_pulse_votes_user ON pulse_votes(user_id);

-- Realtime enabled for live Pulse updates
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE pulse_statements;
-- Migration 004: Bridge Sessions

CREATE TABLE public.bridge_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id UUID REFERENCES profiles(id),
  user_b_id UUID REFERENCES profiles(id),
  topic_id UUID REFERENCES pulse_topics(id),
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'completed', 'declined')
  ),
  match_score DECIMAL,
  prompt_sequence JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bridge_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES bridge_sessions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  content TEXT,
  prompt_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bridge_sessions_user_a ON bridge_sessions(user_a_id);
CREATE INDEX idx_bridge_sessions_user_b ON bridge_sessions(user_b_id);
CREATE INDEX idx_bridge_messages_session ON bridge_messages(session_id);

ALTER PUBLICATION supabase_realtime ADD TABLE bridge_messages;
-- Migration 005: Bridging & Trust Score History

CREATE TABLE public.bridging_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  score DECIMAL,
  cluster_breakdown JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trust_score_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  score DECIMAL,
  reason TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bridging_history_post ON bridging_score_history(post_id);
CREATE INDEX idx_trust_history_user ON trust_score_history(user_id);
-- Migration 006: Row Level Security Policies

-- Profiles: public read, own write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Posts: public read, authenticated write
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE USING (auth.uid() = author_id);

-- Engagements: authenticated only
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Engagements are viewable by everyone"
  ON engagements FOR SELECT USING (true);
CREATE POLICY "Users can manage own engagements"
  ON engagements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own engagements"
  ON engagements FOR DELETE USING (auth.uid() = user_id);

-- Pulse topics: public read, authenticated create
ALTER TABLE pulse_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics are viewable by everyone"
  ON pulse_topics FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create topics"
  ON pulse_topics FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Pulse statements: public read, authenticated create
ALTER TABLE pulse_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Statements are viewable by everyone"
  ON pulse_statements FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create statements"
  ON pulse_statements FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Pulse votes: authenticated only
ALTER TABLE pulse_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are viewable by everyone"
  ON pulse_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage own votes"
  ON pulse_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes"
  ON pulse_votes FOR DELETE USING (auth.uid() = user_id);

-- Bridge sessions: participants only
ALTER TABLE bridge_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bridge participants can view their sessions"
  ON bridge_sessions FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Authenticated users can create bridge sessions"
  ON bridge_sessions FOR INSERT WITH CHECK (auth.uid() = user_a_id);
CREATE POLICY "Participants can update session status"
  ON bridge_sessions FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Bridge messages: participants only
ALTER TABLE bridge_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bridge participants can view messages"
  ON bridge_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bridge_sessions
      WHERE id = bridge_messages.session_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );
CREATE POLICY "Bridge participants can send messages"
  ON bridge_messages FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bridge_sessions
      WHERE id = bridge_messages.session_id
      AND status = 'active'
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );
-- Migration 007: Invites & Referral Tracking

CREATE TABLE public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inviter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  invited_email TEXT,                      -- Optional, if sent to a specific person
  accepted_by UUID REFERENCES profiles(id),-- Filled when someone signs up with this code
  accepted_at TIMESTAMPTZ,
  trust_bonus_awarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_inviter ON invites(inviter_id);
CREATE INDEX idx_invites_code ON invites(invite_code);
CREATE INDEX idx_invites_accepted_by ON invites(accepted_by);

-- RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Users can see their own invites
CREATE POLICY "Users can view own invites"
  ON invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = accepted_by);

-- Authenticated users can create invites
CREATE POLICY "Users can create invites"
  ON invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

-- Anyone can claim an invite (update accepted_by) — service role handles validation
CREATE POLICY "Users can accept invites"
  ON invites FOR UPDATE
  USING (accepted_by IS NULL OR auth.uid() = accepted_by);

-- Add invite count to profiles for quick display
ALTER TABLE profiles ADD COLUMN invite_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN invited_by UUID REFERENCES profiles(id);
-- Migration 008: Rate Limiting & Bot Detection

-- Track all rate-limited actions for throttling
CREATE TABLE public.rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'post', 'engage', 'vote', 'message', 'invite'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_user_action ON rate_limit_log(user_id, action, created_at DESC);

-- Bot detection: track engagement velocity per user
CREATE TABLE public.engagement_velocity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  engagement_count INTEGER DEFAULT 0,
  avg_interval_ms INTEGER,               -- Average ms between engagements in this window
  flagged BOOLEAN DEFAULT FALSE,          -- True if velocity looks non-human
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_velocity_user ON engagement_velocity(user_id, created_at DESC);
CREATE INDEX idx_velocity_flagged ON engagement_velocity(flagged) WHERE flagged = TRUE;

-- Bot suspicion flags on profiles
ALTER TABLE profiles ADD COLUMN bot_score DECIMAL DEFAULT 0.0;  -- 0.0 = human, 1.0 = certainly bot
ALTER TABLE profiles ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN suspension_reason TEXT;
ALTER TABLE profiles ADD COLUMN is_human_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN behavioral_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN pulse_votes_count INTEGER DEFAULT 0;  -- Track for behavioral gate

-- RLS for rate_limit_log (service role writes, users can read own)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rate limit log"
  ON rate_limit_log FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE engagement_velocity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own velocity"
  ON engagement_velocity FOR SELECT USING (auth.uid() = user_id);

-- Function to check rate limit (called from Edge Functions)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_count INTEGER,
  p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;

  IF recent_count >= p_max_count THEN
    RETURN FALSE;  -- Rate limited
  END IF;

  -- Log this action
  INSERT INTO rate_limit_log (user_id, action) VALUES (p_user_id, p_action);
  RETURN TRUE;  -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment pulse vote count and check behavioral gate
CREATE OR REPLACE FUNCTION increment_pulse_votes(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET pulse_votes_count = pulse_votes_count + 1,
      behavioral_verified = CASE
        WHEN pulse_votes_count + 1 >= 5 THEN TRUE
        ELSE behavioral_verified
      END,
      is_human_verified = CASE
        WHEN (pulse_votes_count + 1 >= 5) OR phone_verified THEN TRUE
        ELSE is_human_verified
      END
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup: auto-delete rate limit logs older than 24 hours (run via pg_cron)
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *',
--   $$DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '24 hours'$$
-- );
-- Migration 009: Content Moderation & Flagging

CREATE TABLE public.content_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'message', 'statement', 'profile')),
  content_id UUID NOT NULL,               -- ID of the flagged content
  flagged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  flagger_cluster_id INTEGER,             -- Stored at flag time for cross-cluster review
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'bot', 'harassment', 'hate_speech', 'misinformation',
    'violence', 'sexual', 'impersonation', 'other'
  )),
  description TEXT,                       -- Optional details from flagger
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'under_review', 'upheld', 'dismissed', 'escalated'
  )),
  reviewed_by UUID REFERENCES profiles(id),
  reviewer_cluster_id INTEGER,            -- Must be different from flagger cluster
  review_note TEXT,
  auto_flagged BOOLEAN DEFAULT FALSE,     -- True if flagged by AI, not a user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_flags_status ON content_flags(status);
CREATE INDEX idx_flags_content ON content_flags(content_type, content_id);
CREATE INDEX idx_flags_pending ON content_flags(status) WHERE status = 'pending';

-- Cross-cluster review requirement:
-- A flag can only be upheld if reviewed by someone from a DIFFERENT cluster than the flagger.
-- This prevents one cluster from silencing another.

-- Moderation actions log
CREATE TABLE public.moderation_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'profile', 'comment')),
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'remove', 'restore', 'warn', 'suspend', 'unsuspend', 'restrict'
  )),
  performed_by UUID REFERENCES profiles(id),
  reason TEXT,
  flag_id UUID REFERENCES content_flags(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mod_actions_target ON moderation_actions(target_type, target_id);

-- Appeal system
CREATE TABLE public.moderation_appeals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id UUID REFERENCES content_flags(id) ON DELETE CASCADE,
  appellant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  appeal_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES profiles(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create flags"
  ON content_flags FOR INSERT WITH CHECK (auth.uid() = flagged_by);
CREATE POLICY "Users can view flags they created"
  ON content_flags FOR SELECT USING (auth.uid() = flagged_by);
-- Moderators/service role handle review updates

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view actions on their content"
  ON moderation_actions FOR SELECT USING (
    target_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
    OR target_id = auth.uid()
  );

ALTER TABLE moderation_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create appeals"
  ON moderation_appeals FOR INSERT WITH CHECK (auth.uid() = appellant_id);
CREATE POLICY "Users can view own appeals"
  ON moderation_appeals FOR SELECT USING (auth.uid() = appellant_id);
-- Migration 010: Advertising Policy & Review System

-- Ad campaigns table
CREATE TABLE public.ad_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('none', 'photo', 'video')) DEFAULT 'none',
  photo_urls TEXT[],
  mux_playback_id TEXT,

  -- Ad targeting (limited — no micro-targeting)
  target_regions TEXT[],                  -- Optional geographic regions
  target_topics TEXT[],                   -- Optional topic tags

  -- Policy enforcement
  status TEXT DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'active', 'paused', 'completed'
  )),
  rejection_reason TEXT,

  -- Bridging requirement: ads must not be divisive
  -- After serving, if bridging_score < 0.3, ad is auto-paused for review
  bridging_score DECIMAL DEFAULT 0.0,
  cluster_reach INTEGER DEFAULT 0,
  divisiveness_score DECIMAL DEFAULT 0.0,  -- Inverse of bridging — high = divisive

  -- Budget
  daily_budget_cents INTEGER,
  total_budget_cents INTEGER,
  spent_cents INTEGER DEFAULT 0,

  -- Review
  reviewed_by UUID REFERENCES profiles(id),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
);

CREATE INDEX idx_ads_status ON ad_campaigns(status);
CREATE INDEX idx_ads_advertiser ON ad_campaigns(advertiser_id);

-- Ad impressions for tracking + bridging score calculation
CREATE TABLE public.ad_impressions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_cluster_id INTEGER,                -- Snapshot at impression time
  engagement_type TEXT CHECK (engagement_type IN (
    'view', 'click', 'agree', 'disagree', 'dismiss', 'flag'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX idx_impressions_created ON ad_impressions(created_at DESC);

-- Ad policy rules (configurable)
CREATE TABLE public.ad_policy_rules (
  id SERIAL PRIMARY KEY,
  rule_name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  threshold DECIMAL,                      -- Numeric threshold for the rule
  action TEXT NOT NULL CHECK (action IN ('reject', 'pause', 'flag_review')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default ad policy rules
INSERT INTO ad_policy_rules (rule_name, description, threshold, action) VALUES
  ('min_bridging_score', 'Ads must maintain a bridging score above this threshold after 100 impressions', 0.3, 'pause'),
  ('max_single_cluster_ratio', 'Reject if more than this % of positive engagement comes from one cluster', 0.8, 'flag_review'),
  ('max_disagree_ratio', 'Pause if disagree rate exceeds this threshold', 0.6, 'pause'),
  ('min_cluster_reach', 'Ads should reach at least this many clusters to stay active', 2, 'flag_review'),
  ('max_flag_rate', 'Auto-reject if flag rate exceeds this % of impressions', 0.05, 'reject');

-- RLS
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Advertisers can view own campaigns"
  ON ad_campaigns FOR SELECT USING (auth.uid() = advertiser_id);
CREATE POLICY "Advertisers can create campaigns"
  ON ad_campaigns FOR INSERT WITH CHECK (auth.uid() = advertiser_id);
CREATE POLICY "Advertisers can update own pending campaigns"
  ON ad_campaigns FOR UPDATE USING (
    auth.uid() = advertiser_id AND status IN ('pending_review', 'rejected', 'paused')
  );

ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
-- Impressions are created by service role, viewable by campaign owner
CREATE POLICY "Advertisers can view own campaign impressions"
  ON ad_impressions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE id = ad_impressions.campaign_id
      AND advertiser_id = auth.uid()
    )
  );

ALTER TABLE ad_policy_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Policy rules are public"
  ON ad_policy_rules FOR SELECT USING (true);
