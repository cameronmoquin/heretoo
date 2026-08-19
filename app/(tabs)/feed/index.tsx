/**
 * Home tab. The feed.
 *
 * One stream, ranked by get_unifying_feed, paginated with
 * useInfiniteQuery, kept current by useFeedRealtime. PostCard carries
 * hearts and comments.
 *
 * The chip row is a lens on that stream. The chip sets feedStore.filter
 * and FeedList decides what to render; the crew chip alone also swaps
 * the post query to the crew column. /loft, /news, and /common all
 * redirect here.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useFeed, useToggleHeart, useFeedRealtime } from '../../../hooks/useFeed';
import { useFeedStore, isFeedFilter, type FeedFilter } from '../../../stores/feedStore';
import { useThemeStore } from '../../../stores/themeStore';
import { useMyNetworkStats } from '../../../hooks/useFamily';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { isKioskBuild } from '../../../modules/heretoo-kiosk';
import { HereTooLogo } from '../../../components/shared/Logo';
import { FeedList } from '../../../components/feed/FeedList';
import { InstallAppBanner } from '../../../components/shared/InstallAppBanner';
import { Colors } from '../../../constants/colors';
import { Layout, Spacing, Radius, Type, Heights } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

// Labels ride Vocab where the lexicon owns the word, so a vocabulary
// change never has to find this row. The last lens keeps its 'drops'
// KEY (keys are identifiers, not copy) but wears the new noun: it shows
// the passing submissions — the 24-hour ones, wherever they were sent.
// The GPS game is the Deaddrop app at /hunt and is not a feed lens; its
// only feed presence is the X card.
const CHIPS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'crew', label: Vocab.Group },
  { key: 'public', label: 'Public' },
  { key: 'news', label: 'News' },
  { key: 'drops', label: Vocab.PostPlural },
];

export default function FeedHomeScreen() {
  const styles = makeStyles();
  // The query is pinned. useFeed and useFeedRealtime still take the tab
  // and it is now always 'for_you'.
  const activeTab = useFeedStore((s) => s.activeTab);
  const filter = useFeedStore((s) => s.filter);
  const setFilter = useFeedStore((s) => s.setFilter);
  const feed = useFeed(activeTab, filter === 'crew');
  useFeedRealtime(activeTab);
  const toggleHeart = useToggleHeart();

  // /loft?filter=public and /news?filter=news land here. Anything else
  // in the param is ignored and the store keeps whatever it had.
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const paramFilter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  React.useEffect(() => {
    if (isFeedFilter(paramFilter)) setFilter(paramFilter);
  }, [paramFilter, setFilter]);
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: stats } = useMyNetworkStats();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  // Memoized because this is the first dependency of FeedList's interleave
  // memo. A fresh array identity every render defeats that memo and makes
  // FlashList re-diff the whole stream on every theme toggle, resize, and
  // heart mutation.
  const posts = React.useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  return (
    /* Opaque and full-bleed. The tab you are NOT on stays mounted at
       z-index -1, and every screen root here is a centred 640 column, so
       an inactive feed used to show in the gutters either side of
       whichever tab you were actually on. Two attempts to fix that from
       the navigator (sceneStyle, then isolation on the tabs wrapper)
       never reached the DOM — both computed to rgba(0,0,0,0) in
       production. A plain backgroundColor on a plain View cannot be
       stripped, so the screen hides its neighbours itself. */
    <View style={styles.screen}>
    <SafeAreaView style={styles.safe} edges={isDesktop ? [] : ['top']}>
      {/* Mobile-only header with brand + utility icons. Desktop uses
          the LeftSidebar so this row is redundant there. */}
      {!isDesktop && (
        <View style={styles.header}>
          <HereTooLogo size={28} color={Colors.textPrimary} />
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/messages')}
              accessibilityLabel="Messages"
            >
              <Ionicons name="chatbubbles-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
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
            {/* Not on a kiosk device. This is an unconfirmed one-tap
                sign-out sitting in the top bar, and the phone it would
                sign out belongs to a kid who cannot type an email and a
                password to get back in. On a provisioned device that
                single icon is the difference between "always signed in"
                and bricked until a parent notices. The device owner can
                still sign out from the PIN panel. */}
            {!isKioskBuild && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => hardSignOutAndRedirect()}
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Horizontal scroll so five chips never wrap or clip at 375px. */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CHIPS.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              selected={filter === chip.key}
              onPress={() => setFilter(chip.key)}
            />
          ))}
        </ScrollView>
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
            {stats.reachable_families === 1 ? ` ${Vocab.group} connected` : ` ${Vocab.groupPlural} connected`}
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
    </View>
  );
}

/**
 * The filter chip. Muted well by default, solid ink when it is the live
 * lens. Pill corners, and nothing else on it.
 *
 * Local to the feed rather than the shared Chip, because the shared one
 * serves rows of options on other screens and belongs to another lane.
 */
function FilterChip({ label, selected, onPress }: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const s = makeStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[s.chipLabel, selected && s.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  safe: {
    flex: 1, backgroundColor: 'transparent',
    maxWidth: Layout.columnMaxWidth, alignSelf: 'center', width: '100%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Layout.columnPadding, paddingVertical: Spacing.xs,
    height: Heights.topHeader,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  chipRowWrap: {
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  chipRow: {
    flexDirection: 'row', gap: Spacing.xs, alignItems: 'center',
    paddingHorizontal: Layout.columnPadding, paddingVertical: 10,
  },
  chip: {
    minHeight: Heights.pill,
    alignSelf: 'flex-start',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
  },
  chipSelected: { backgroundColor: Colors.primary },
  chipLabel: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight, color: Colors.textSecondary,
  },
  chipLabelSelected: { color: Colors.onPrimary },
  statsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: Layout.columnPadding, marginTop: Spacing.sm,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt, alignSelf: 'flex-start',
  },
  statsText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
}); }
