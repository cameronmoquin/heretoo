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
