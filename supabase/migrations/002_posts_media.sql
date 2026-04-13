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
