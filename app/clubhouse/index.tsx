/**
^ * /clubhouse — the Clubhouse (the members' feed). Anyone can read; posting needs an account.
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { Page, PageTitle, Muted, Loading } from '../../components/nffga/board/Page';
import { Composer } from '../../components/nffga/board/Composer';
import { PostCard } from '../../components/nffga/board/PostCard';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { useBoardFeed } from '../../lib/nffga/board';

export default function BoardScreen() {
  const feed = useBoardFeed();
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <Page
      title="Clubhouse"
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()} tintColor={Colors.textMuted} />
      }
    >
      <PageTitle>Clubhouse</PageTitle>
      <RequireAccount reason="to post">
        <Composer />
      </RequireAccount>

      {feed.isLoading ? <Loading /> : null}
      {!feed.isLoading && posts.length === 0 ? <Muted>No posts yet.</Muted> : null}
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
    </Page>
  );
}
