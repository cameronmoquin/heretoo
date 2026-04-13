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
