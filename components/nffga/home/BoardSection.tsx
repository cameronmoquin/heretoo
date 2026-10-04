/**
 * BoardSection — the home page's view of the clubhouse board: the
 * latest three posts. Zero props; the shell mounts it.
 */
import React from 'react';
import { HomeSection } from '../HomeSection';
import { PostCard } from '../board/PostCard';
import { useLatestPosts } from '../../../lib/nffga/board';

export function BoardSection() {
  const latest = useLatestPosts(3);
  const posts = latest.data ?? [];
  return (
    <HomeSection title="Clubhouse" href="/clubhouse" empty={latest.isLoading ? 'Loading posts.' : 'No posts yet.'}>
      {posts.map((p) => <PostCard key={p.id} post={p} compact />)}
    </HomeSection>
  );
}
