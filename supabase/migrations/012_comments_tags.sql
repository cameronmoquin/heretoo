-- Migration 012: Comments & Image Tags

-- Comments on posts
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- for reply threads
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_comments_post ON comments(post_id, created_at);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- Add comment count to posts for quick display
ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0;

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- Image tags (people tagged in photos)
CREATE TABLE public.image_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tagged_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  x_position DECIMAL,  -- 0.0 to 1.0 relative position on image
  y_position DECIMAL,
  photo_index INTEGER DEFAULT 0,  -- which photo in the array
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tagged_user_id, photo_index)
);

CREATE INDEX idx_image_tags_post ON image_tags(post_id);
CREATE INDEX idx_image_tags_user ON image_tags(tagged_user_id);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment"
  ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE USING (auth.uid() = author_id);

ALTER TABLE image_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Image tags are viewable by everyone"
  ON image_tags FOR SELECT USING (true);
CREATE POLICY "Post authors can add tags"
  ON image_tags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE id = image_tags.post_id AND author_id = auth.uid())
  );
CREATE POLICY "Post authors can remove tags"
  ON image_tags FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts WHERE id = image_tags.post_id AND author_id = auth.uid())
    OR tagged_user_id = auth.uid()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE comments;
