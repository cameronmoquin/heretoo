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
