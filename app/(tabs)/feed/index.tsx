import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFeed, useToggleHeart } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useMyNetworkStats } from '../../../hooks/useFamily';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { FeedList } from '../../../components/feed/FeedList';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'connections', label: 'Connections' },
];

export default function FeedScreen() {
  const styles = makeStyles();
  const { activeTab, setActiveTab } = useFeedStore();
  const feed = useFeed(activeTab);
  const toggleHeart = useToggleHeart();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: stats } = useMyNetworkStats();
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.signOutIconBtn}
              onPress={() => router.push('/chat' as any)}
              accessibilityLabel="Messages"
            >
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.familyPill}
              onPress={() => router.push('/family' as any)}
              accessibilityLabel="Go to families"
            >
              <Ionicons name="people-outline" size={15} color={Colors.primary} />
              <Text style={styles.familyPillText}>Families</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutIconBtn}
              onPress={toggleTheme}
              accessibilityLabel="Toggle light/dark theme"
            >
              <Ionicons
                name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutIconBtn}
              onPress={() => hardSignOutAndRedirect()}
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
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

      {stats && stats.reachable_profiles > 1 && (
        <TouchableOpacity
          style={styles.statsBanner}
          onPress={() => router.push('/family')}
          activeOpacity={0.8}
        >
          <Ionicons name="git-network-outline" size={14} color={Colors.primary} />
          <Text style={styles.statsText}>
            <Text style={{ fontWeight: '700' }}>{stats.reachable_profiles}</Text>
            {' people in your network · '}
            <Text style={{ fontWeight: '700' }}>{stats.reachable_families}</Text>
            {stats.reachable_families === 1 ? ' family connected' : ' families connected'}
          </Text>
        </TouchableOpacity>
      )}

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

function makeStyles() { return StyleSheet.create({
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
  familyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.primaryFaint,
  },
  familyPillText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  tabBar: { position: 'absolute', bottom: 0, width: 26, height: 2, borderRadius: 1, backgroundColor: Colors.primary },
  statsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginTop: 10,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1, borderColor: Colors.border,
    alignSelf: 'flex-start',
  },
  statsText: { fontSize: 12, color: Colors.textSecondary },
}); }
