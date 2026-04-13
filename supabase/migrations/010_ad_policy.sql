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
