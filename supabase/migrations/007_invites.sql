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
