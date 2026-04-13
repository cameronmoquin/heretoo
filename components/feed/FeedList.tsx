import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { AdSlot } from '../shared/AdSlot';
import { getAdForPosition } from '../../lib/mock-ads';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Spacing } from '../../constants/design';
import type { Post, EngagementType } from '../../stores/feedStore';

interface FeedListProps {
  posts: Post[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onEngage: (postId: string, type: EngagementType) => void;
}

type FeedItem =
  | { type: 'post'; data: Post }
  | { type: 'ad'; data: ReturnType<typeof getAdForPosition> };

export function FeedList({
  posts,
  isLoading,
  isRefreshing,
  hasMore,
  onRefresh,
  onLoadMore,
  onEngage,
}: FeedListProps) {
  // Interleave ads between posts
  const feedItems: FeedItem[] = [];
  posts.forEach((post, i) => {
    feedItems.push({ type: 'post', data: post });
    const ad = getAdForPosition(i);
    if (ad) {
      feedItems.push({ type: 'ad', data: ad });
    }
  });

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.type === 'ad' && item.data) {
        return <AdSlot ad={item.data} />;
      }
      if (item.type === 'post') {
        return <PostCard post={item.data as Post} onEngage={onEngage} />;
      }
      return null;
    },
    [onEngage]
  );

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Nothing here yet.</Text>
        <Text style={styles.emptySubtitle}>
          That changes when you show up.
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={feedItems}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item.type === 'post'
          ? (item.data as Post).id
          : `ad-${index}`
      }
      contentContainerStyle={{ paddingTop: Spacing.sm, paddingBottom: 100 }}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
      ListFooterComponent={
        hasMore ? (
          <View style={styles.footer}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.heading,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
});
