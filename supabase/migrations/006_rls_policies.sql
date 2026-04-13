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
