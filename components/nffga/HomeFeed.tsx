/**
 * HomeFeed — the feed, on the landing page (Cameron, 2026-10-04: "lets put
 * the feed on there. it will be blank. no bots in this build").
 *
 * The same posts as /board, newest first, with the composer on top.
 * Signed out, the composer becomes the join prompt — that is the funnel.
 * Nothing here is generated: every post is a member's.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Composer } from './board/Composer';
import { PostCard } from './board/PostCard';
import { RequireAccount } from './RequireAccount';
import { Button } from '../shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { useBoardFeed } from '../../lib/nffga/board';

export function HomeFeed() {
  const s = makeStyles();
  const feed = useBoardFeed();
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Feed</Text>
      <RequireAccount reason="to post">
        <Composer />
      </RequireAccount>
      {feed.isLoading ? <Text style={s.muted}>Loading.</Text> : null}
      {!feed.isLoading && posts.length === 0 ? <Text style={s.muted}>No posts yet.</Text> : null}
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
      {feed.hasNextPage ? (
        <Button
          title="Show more"
          onPress={() => feed.fetchNextPage()}
          variant="outline"
          size="md"
          loading={feed.isFetchingNextPage}
        />
      ) : null}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { gap: Spacing.sm },
  title: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  muted: { fontSize: 15, color: Colors.textMuted },
}); }
