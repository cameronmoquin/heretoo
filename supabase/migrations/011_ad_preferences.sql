-- Migration 011: User Ad Preferences & Subscription

-- User ad preferences — which categories they opted into
CREATE TABLE public.user_ad_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,        -- e.g. 'sports', 'clothing'
  subcategory_id TEXT,              -- e.g. 'sports_basketball', null = whole category
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, subcategory_id)
);

CREATE INDEX idx_ad_prefs_user ON user_ad_preferences(user_id);

-- Subscription status for ad-free tier
ALTER TABLE profiles ADD COLUMN is_ad_free BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN ad_free_background TEXT DEFAULT NULL;  -- background choice ID
ALTER TABLE profiles ADD COLUMN ad_preferences_set BOOLEAN DEFAULT FALSE;  -- true after onboarding

-- RLS
ALTER TABLE user_ad_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ad preferences"
  ON user_ad_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ad preferences"
  ON user_ad_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ad preferences"
  ON user_ad_preferences FOR DELETE USING (auth.uid() = user_id);
