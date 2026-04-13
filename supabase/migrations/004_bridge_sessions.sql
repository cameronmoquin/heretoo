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
