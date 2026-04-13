-- Migration 001: Auth & Profiles

CREATE TABLE public.clusters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  display_color TEXT NOT NULL,
  description TEXT
);

INSERT INTO clusters (name, display_color) VALUES
  ('pragmatic_center', '#6B7280'),
  ('community_focused', '#3B82F6'),
  ('tradition_minded', '#92400E'),
  ('reform_oriented', '#10B981'),
  ('liberty_focused', '#F59E0B'),
  ('unclassified', '#D1D5DB');

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  birth_year INTEGER,
  location_region TEXT,
  origin_story TEXT,
  trust_score DECIMAL DEFAULT 0.0,
  cluster_id INTEGER REFERENCES clusters(id) DEFAULT 6,
  cluster_confidence DECIMAL DEFAULT 0.0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
