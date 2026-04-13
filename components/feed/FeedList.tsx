import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { AdSlot } from '../shared/AdSlot';
import { getAdForPosition } from '../../lib/mock-ads';
import { Colors } from '../../constants/colors';
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

type FeedItem = { type: 'post'; data: Post } | { type: 'ad'; data: ReturnType<typeof getAdForPosition> };

export function FeedList({ posts, isLoading, isRefreshing, hasMore, onRefresh, onLoadMore, onEngage }: FeedListProps) {
  const items: FeedItem[] = [];
  posts.forEach((post, i) => {
    items.push({ type: 'post', data: post });
    const ad = getAdForPosition(i);
    if (ad) items.push({ type: 'ad', data: ad });
  });

  const renderItem = useCallback(({ item }: { item: FeedItem }) => {
    if (item.type === 'ad' && item.data) return <AdSlot ad={item.data} />;
    if (item.type === 'post') return <PostCard post={item.data as Post} onEngage={onEngage} />;
    return null;
  }, [onEngage]);

  if (isLoading && posts.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (!isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nothing here yet.</Text>
        <Text style={styles.emptySub}>That changes when you show up.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item, i) => item.type === 'post' ? (item.data as Post).id : `ad-${i}`}
      contentContainerStyle={{ paddingBottom: 100 }}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      ListFooterComponent={hasMore ? <View style={styles.footer}><ActivityIndicator color={Colors.primary} /></View> : null}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, fontWeight: '400', color: Colors.textSecondary, textAlign: 'center' },
  footer: { padding: Spacing.lg, alignItems: 'center' },
});
