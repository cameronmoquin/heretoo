import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFeed, useToggleHeart } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { FeedList } from '../../../components/feed/FeedList';
import { Colors } from '../../../constants/colors';
import { Spacing } from '../../../constants/design';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'connections', label: 'Connections' },
];

export default function FeedScreen() {
  const { activeTab, setActiveTab } = useFeedStore();
  const feed = useFeed(activeTab);
  const toggleHeart = useToggleHeart();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={isDesktop ? [] : ['top']}>
      {!isDesktop && (
        <View style={styles.header}>
          <View style={{ position: 'relative' }}>
            <Text style={[styles.logo, { color: '#FF0040', position: 'absolute', left: -1, top: -1, opacity: 0.6 }]}>HT</Text>
            <Text style={[styles.logo, { color: '#00FF88', position: 'absolute', left: 1, top: 1, opacity: 0.6 }]}>HT</Text>
            <Text style={styles.logo}>HT</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutIconBtn}
            onPress={() => hardSignOutAndRedirect()}
            accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {active && <View style={styles.tabBar} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <FeedList
        posts={posts as any}
        isLoading={feed.isLoading}
        isRefreshing={feed.isRefetching}
        hasMore={feed.hasNextPage ?? false}
        onRefresh={() => feed.refetch()}
        onLoadMore={() => feed.fetchNextPage()}
        onHeart={(postId) => toggleHeart.mutate(postId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  logo: { fontWeight: '800', fontSize: 22, letterSpacing: -0.5, color: Colors.textPrimary },
  signOutIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  tabBar: { position: 'absolute', bottom: 0, width: 26, height: 2, borderRadius: 1, backgroundColor: Colors.primary },
});
