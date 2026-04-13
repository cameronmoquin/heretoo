import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeed, useToggleEngagement } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { FeedList } from '../../../components/feed/FeedList';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/typography';
import { Spacing } from '../../../constants/design';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'bridging', label: 'Bridging' },
];

export default function FeedScreen() {
  const { activeTab, setActiveTab } = useFeedStore();
  const feed = useFeed(activeTab);
  const toggleEngagement = useToggleEngagement();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={isDesktop ? [] : ['top']}>
      {!isDesktop && (
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={{ color: Colors.textPrimary }}>HERE</Text>
            <Text style={{ color: Colors.primary }}>Too</Text>
          </Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {active && <View style={styles.tabBar} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <FeedList
        posts={posts}
        isLoading={feed.isLoading}
        isRefreshing={feed.isRefetching}
        hasMore={feed.hasNextPage ?? false}
        onRefresh={() => feed.refetch()}
        onLoadMore={() => feed.fetchNextPage()}
        onEngage={(postId, type) => toggleEngagement.mutate({ postId, type })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  logo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 15,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontFamily: Fonts.bodySemiBold,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.primary,
  },
});
