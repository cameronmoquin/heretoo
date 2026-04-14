-- Migration 013: WAMP Token Ledger

-- Wallet balance per user
CREATE TABLE public.wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL DEFAULT 0.0,
  lifetime_earned DECIMAL DEFAULT 0.0,
  lifetime_spent DECIMAL DEFAULT 0.0,
  lifetime_transferred DECIMAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- Every WAMP movement is a transaction
CREATE TABLE public.wamp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'earn_vote',           -- voted on a pulse statement
    'earn_bridge',         -- completed a bridge conversation
    'earn_post_bridging',  -- post reached 3+ clusters
    'earn_comment',        -- commented on a post
    'earn_daily_login',    -- showed up today
    'earn_invite_accepted',-- someone used your invite
    'spend_invite',        -- spent token to invite someone
    'transfer_out',        -- sent to another user
    'transfer_in',         -- received from another user
    'bonus',               -- admin/system bonus
    'genesis'              -- initial token grant for early members
  )),
  amount DECIMAL NOT NULL,
  balance_after DECIMAL NOT NULL,
  related_id UUID,             -- post_id, session_id, invite_id, etc
  recipient_id UUID REFERENCES profiles(id),  -- for transfers
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wamp_tx_wallet ON wamp_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_wamp_tx_user ON wamp_transactions(user_id, created_at DESC);
CREATE INDEX idx_wamp_tx_type ON wamp_transactions(type);

-- Invite codes now cost 1 WAMP
-- Add wamp_cost to invites table
ALTER TABLE invites ADD COLUMN wamp_cost DECIMAL DEFAULT 1.0;

-- RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE wamp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions"
  ON wamp_transactions FOR SELECT USING (auth.uid() = user_id);

-- Function: credit WAMP to a user
CREATE OR REPLACE FUNCTION credit_wamp(
  p_user_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_related_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- Get or create wallet
  INSERT INTO wallets (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;

  -- Update balance
  UPDATE wallets
  SET balance = balance + p_amount,
      lifetime_earned = lifetime_earned + p_amount
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO wamp_transactions (wallet_id, user_id, type, amount, balance_after, related_id, note)
  VALUES (v_wallet_id, p_user_id, p_type, p_amount, v_new_balance, p_related_id, p_note);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: spend WAMP
CREATE OR REPLACE FUNCTION spend_wamp(
  p_user_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_related_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
  v_wallet_id UUID;
  v_current DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_current FROM wallets WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL OR v_current < p_amount THEN
    RAISE EXCEPTION 'Insufficient WAMP balance';
  END IF;

  UPDATE wallets
  SET balance = balance - p_amount,
      lifetime_spent = lifetime_spent + p_amount
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO wamp_transactions (wallet_id, user_id, type, amount, balance_after, related_id, note)
  VALUES (v_wallet_id, p_user_id, p_type, -p_amount, v_new_balance, p_related_id, p_note);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: transfer WAMP between users
CREATE OR REPLACE FUNCTION transfer_wamp(
  p_from_user UUID,
  p_to_user UUID,
  p_amount DECIMAL,
  p_note TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_from_wallet UUID;
  v_to_wallet UUID;
  v_from_balance DECIMAL;
  v_to_balance DECIMAL;
BEGIN
  -- Check sender balance
  SELECT id, balance INTO v_from_wallet, v_from_balance FROM wallets WHERE user_id = p_from_user;
  IF v_from_wallet IS NULL OR v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient WAMP balance';
  END IF;

  -- Ensure recipient wallet exists
  INSERT INTO wallets (user_id) VALUES (p_to_user)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT id INTO v_to_wallet FROM wallets WHERE user_id = p_to_user;

  -- Debit sender
  UPDATE wallets SET balance = balance - p_amount, lifetime_transferred = lifetime_transferred + p_amount
  WHERE id = v_from_wallet RETURNING balance INTO v_from_balance;

  INSERT INTO wamp_transactions (wallet_id, user_id, type, amount, balance_after, recipient_id, note)
  VALUES (v_from_wallet, p_from_user, 'transfer_out', -p_amount, v_from_balance, p_to_user, p_note);

  -- Credit recipient
  UPDATE wallets SET balance = balance + p_amount, lifetime_earned = lifetime_earned + p_amount
  WHERE id = v_to_wallet RETURNING balance INTO v_to_balance;

  INSERT INTO wamp_transactions (wallet_id, user_id, type, amount, balance_after, recipient_id, note)
  VALUES (v_to_wallet, p_to_user, 'transfer_in', p_amount, v_to_balance, p_from_user, p_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
