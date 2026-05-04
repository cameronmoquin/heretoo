import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFeed, useToggleHeart, useFeedRealtime } from '../../../hooks/useFeed';
import { useFeedStore, type FeedTab } from '../../../stores/feedStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useMyNetworkStats } from '../../../hooks/useFamily';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { HereTooLogo } from '../../../components/shared/Logo';
import { FeedList } from '../../../components/feed/FeedList';
import { InstallAppBanner } from '../../../components/shared/InstallAppBanner';
import { CalendarEmbed } from '../../../components/shared/CalendarEmbed';
import { FamilyEventInvite } from '../../../components/shared/FamilyEventInvite';
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
  useFeedRealtime(activeTab);
  const toggleHeart = useToggleHeart();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: stats } = useMyNetworkStats();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // Only show right sidebar on truly wide viewports — under 1024px
  // the feed needs the whole width to read comfortably.
  const showSidebar = width >= 1024;
  const posts = feed.data?.pages.flat() ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={isDesktop ? [] : ['top']}>
      {!isDesktop && (
        <View style={styles.header}>
          <HereTooLogo size={28} color={Colors.textPrimary} />
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
          onPress={() => router.push('/network' as any)}
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

      {/* Persistent install banner — different from the auto-popup;
          sits in the feed flow so users always have a visible install
          option, not just the once-fired beforeinstallprompt event. */}
      <InstallAppBanner />

      {/* Two-column desktop layout: feed on the left, sidebar on the
          right (calendar, family-event invite). Sidebar shows only on
          wide viewports (≥1024px) so mobile gets the full feed width.
          The sidebar's contents will surface on mobile via the
          three-bars overflow menu in a future batch. */}
      <View style={[styles.body, !showSidebar && { paddingHorizontal: 0 }]}>
        <View style={styles.feedCol}>
          <FeedList
            posts={posts as any}
            isLoading={feed.isLoading}
            isRefreshing={feed.isRefetching}
            hasMore={feed.hasNextPage ?? false}
            onRefresh={() => feed.refetch()}
            onLoadMore={() => feed.fetchNextPage()}
            onHeart={(postId) => toggleHeart.mutate(postId)}
          />
        </View>
        {showSidebar && (
          <View style={styles.sidebarCol}>
            <CalendarEmbed />
            <FamilyEventInvite />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  // Transparent so the root-layout wallpaper bleeds through into the
  // edge / margin space the feed column doesn't fill on wide viewports.
  // The actual reading-surface contrast comes from each PostCard's
  // own backgroundColor, not the page wrapper.
  safe: { flex: 1, backgroundColor: 'transparent' },
  // Two-column body — feed on the left, sidebar on the right.
  // Stacks vertically on narrow viewports via maxWidth on sidebar.
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 8,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  feedCol: { flex: 1, minWidth: 0 },
  sidebarCol: {
    width: 320,
    gap: 12,
    paddingTop: 4,
    paddingBottom: 80, // clears the bottom nav
    // Hide on narrow viewports (mobile / small tablet). RN-Web
    // honors @media via display:none — but RN doesn't expose media
    // queries, so we use a flex-basis trick: width:0 on small,
    // 320 on wide. Done via the wrapper's flexWrap pattern in
    // the body style so on narrow the sidebar wraps below feed.
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    height: 52,
  },
  // Borderless icon buttons read as cleaner — the surface depth comes
  // from background contrast rather than a hard outline.
  signOutIconBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  familyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
  },
  familyPillText: {
    fontSize: 13, fontWeight: '600', color: Colors.primary,
    letterSpacing: 0.1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: {
    fontSize: 14, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.1,
  },
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
    backgroundColor: Colors.primaryFaint,
    alignSelf: 'flex-start',
  },
  statsText: {
    fontSize: 12, lineHeight: 16, color: Colors.textSecondary,
  },
}); }
