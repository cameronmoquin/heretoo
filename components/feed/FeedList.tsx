import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { ArtSlot } from './ArtSlot';
import { FeedComposer } from './FeedComposer';
import { useArtFeed, type ArtWork } from '../../hooks/useArtFeed';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import type { Post } from '../../stores/feedStore';

interface FeedListProps {
  posts: Post[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onHeart?: (postId: string) => void;
}

type FeedItem =
  | { kind: 'post'; post: Post }
  | { kind: 'art'; art: ArtWork };

const ART_INTERVAL = 6; // one art slot every N posts

export function FeedList({
  posts, isLoading, isRefreshing, hasMore, onRefresh, onLoadMore, onHeart,
}: FeedListProps) {
  const styles = makeStyles();
  const { data: art } = useArtFeed();

  // Interleave: post, post, ..., art (every ART_INTERVAL posts).
  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    let artIdx = 0;
    posts.forEach((p, i) => {
      out.push({ kind: 'post', post: p });
      if ((i + 1) % ART_INTERVAL === 0 && art && art.length > 0) {
        out.push({ kind: 'art', art: art[artIdx % art.length] });
        artIdx++;
      }
    });
    return out;
  }, [posts, art]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'post') return <PostCard post={item.post} onHeart={onHeart} />;
      return <ArtSlot art={item.art} />;
    },
    [onHeart],
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    return item.kind === 'post' ? `post:${item.post.id}` : `art:${item.art.id}`;
  }, []);

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <FeedComposer />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <FeedComposer />
        <View style={styles.center}>
          <Text style={styles.empty}>Nothing to see yet. Make the first post.</Text>
        </View>
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={FeedComposer}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
      contentContainerStyle={styles.list}
    />
  );
}

function makeStyles() { return StyleSheet.create({
  list: { paddingBottom: 80 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, minHeight: 200,
  },
  empty: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
}); }
