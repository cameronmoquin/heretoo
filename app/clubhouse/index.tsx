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
import { useCopy } from '../../lib/nffga/copy';
import { SitePhotoStrip } from '../../components/nffga/SitePhotoStrip';

export default function BoardScreen() {
  const feed = useBoardFeed();
  const posts = feed.data?.pages.flat() ?? [];
  const empty = useCopy('clubhouse.empty');

  return (
    <Page
      title="Clubhouse"
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()} tintColor={Colors.textMuted} />
      }
    >
      <PageTitle>Clubhouse</PageTitle>
      <SitePhotoStrip placement="clubhouse" />
      <RequireAccount reason="to post">
        <Composer />
      </RequireAccount>

      {feed.isLoading ? <Loading /> : null}
      {!feed.isLoading && posts.length === 0 ? <Muted>{empty}</Muted> : null}
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
