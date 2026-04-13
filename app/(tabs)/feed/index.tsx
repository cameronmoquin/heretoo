import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeed, useToggleEngagement } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { FeedList } from '../../../components/feed/FeedList';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/typography';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'bridging', label: 'Bridging' },
];

export default function FeedScreen() {
  const { activeTab, setActiveTab } = useFeedStore();
  const feed = useFeed(activeTab);
  const toggleEngagement = useToggleEngagement();

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: Colors.textPrimary }}>HERE</Text>
          <Text style={{ color: Colors.primary }}>Too</Text>
        </Text>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      <FeedList
        posts={posts}
        isLoading={feed.isLoading}
        isRefreshing={feed.isRefetching}
        hasMore={feed.hasNextPage ?? false}
        onRefresh={() => feed.refetch()}
        onLoadMore={() => feed.fetchNextPage()}
        onEngage={(postId, type) =>
          toggleEngagement.mutate({ postId, type })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  logo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 24,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.primaryFaint,
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
});
