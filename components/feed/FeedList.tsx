import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
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

export function FeedList({
  posts, isLoading, isRefreshing, hasMore, onRefresh, onLoadMore, onHeart,
}: FeedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Post }) => <PostCard post={item} onHeart={onHeart} />,
    [onHeart],
  );

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Nothing to see yet. Make the first post.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={posts}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
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

const styles = StyleSheet.create({
  list: { paddingBottom: 80 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, minHeight: 200,
  },
  empty: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
