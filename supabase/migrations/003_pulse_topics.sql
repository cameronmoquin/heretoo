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
