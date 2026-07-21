/**
 * /common — the cross-crew unifying feed.
 *
 * Source of Truth, Milestone 1: the feed is no longer the front door.
 * The Room (at /) replaces it. The feed lives here as a fallback
 * for users who want the chronological-ish list view of every post
 * across their crew network.
 *
 * Functionally identical to the old /(tabs)/feed page — same For You
 * and Connections tabs, same unifying-feed ranker, same realtime
 * updates. The Room presents 3 postcards out of the same query.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFeed, useToggleHeart, useFeedRealtime } from '../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../stores/feedStore';
import { useThemeStore } from '../../stores/themeStore';
import { useMyNetworkStats } from '../../hooks/useFamily';
import { hardSignOutAndRedirect } from '../../lib/auth-recovery';
import { HereTooLogo } from '../../components/shared/Logo';
import { FeedList } from '../../components/feed/FeedList';
import { InstallAppBanner } from '../../components/shared/InstallAppBanner';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'connections', label: 'Connections' },
];

export default function CommonScreen() {
  const styles = makeStyles();
  const { activeTab, setActiveTab } = useFeedStore();
  const feed = useFeed(activeTab);
  useFeedRealtime(activeTab);
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
          <TouchableOpacity
            onPress={() => router.replace('/' as any)}
            accessibilityLabel="Back to the Room"
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text style={styles.backText}>Room</Text>
          </TouchableOpacity>
          <HereTooLogo size={28} color={Colors.textPrimary} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.iconBtn}
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
              style={styles.iconBtn}
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
          onPress={() => router.push('/network' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="git-network-outline" size={14} color={Colors.primary} />
          <Text style={styles.statsText}>
            <Text style={{ fontWeight: '700' }}>{stats.reachable_profiles}</Text>
            {' people in your network · '}
            <Text style={{ fontWeight: '700' }}>{stats.reachable_families}</Text>
            {stats.reachable_families === 1 ? ' crew connected' : ' crews connected'}
          </Text>
        </TouchableOpacity>
      )}

      <InstallAppBanner />

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
  safe: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8, height: 52,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 4, paddingRight: 8,
  },
  backText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  iconBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.1 },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '700' },
  tabBar: {
    position: 'absolute', bottom: -1,
    width: 32, height: 2.5, borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  statsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint, alignSelf: 'flex-start',
  },
  statsText: { fontSize: 12, lineHeight: 16, color: Colors.textSecondary },
}); }
