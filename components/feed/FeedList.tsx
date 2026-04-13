import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { Colors } from '../../constants/colors';
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

export function FeedList({
  posts,
  isLoading,
  isRefreshing,
  hasMore,
  onRefresh,
  onLoadMore,
  onEngage,
}: FeedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onEngage={onEngage} />
    ),
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
      data={posts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
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
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
});
