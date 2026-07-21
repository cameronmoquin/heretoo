import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { ArtSlot } from './ArtSlot';
import { ArtBanner } from './ArtBanner';
import { NewsCard } from './NewsCard';
import { LoftCard } from './LoftCard';
import { DropCard } from './DropCard';
import { FeedComposer } from './FeedComposer';
import { useArtFeed, type ArtWork } from '../../hooks/useArtFeed';
import { useNewsFeed, type NewsItem } from '../../hooks/useNews';
import { useLoftFeed, type LoftPost } from '../../hooks/useLoft';
import { usePublicHuntCaches, type HuntCache } from '../../hooks/useHunt';
import { useArtPrefs } from '../../stores/artPrefsStore';
import { useBrokenArt } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { useFeedStore, type Post } from '../../stores/feedStore';

interface FeedListProps {
  posts: Post[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onHeart?: (postId: string) => void;
}

type FeedItem =
  | { kind: 'post'; post: Post }
  // `slot` disambiguates the key. The art pool wraps when it is smaller
  // than the number of slots, so the same piece can appear more than once
  // in one stream and its id alone is not unique.
  | { kind: 'art'; art: ArtWork; slot: number }
  | { kind: 'news'; news: NewsItem }
  | { kind: 'loft'; loft: LoftPost }
  | { kind: 'drop'; drop: HuntCache };

const ART_INTERVAL = 6;       // a new piece every N posts after the first slot
const FIRST_ART_AT = 1;       // show the first art piece right after the very first post

// Density cap. RSS publishes hundreds of items a day; a crew publishes a
// handful. Ungated, the wire buries the people. One item per this many
// posts, hard ceiling. Loft and drops carry the same ceiling on their own
// counters, so no single outside source can spend another's budget or
// swamp the column.
const NEWS_EVERY = 4;

/** Epoch ms, 0 for anything unparseable. Never throws. */
function ms(iso: string | null | undefined): number {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
}

/** One non-crew source walking alongside the post stream. */
interface Rail {
  list: readonly any[];
  at: number;            // pointer into `list`
  since: number;         // posts emitted since this rail last placed a card
  time: (row: any) => number;
  make: (row: any) => FeedItem;
}

export function FeedList({
  posts, isLoading, isRefreshing, hasMore, onRefresh, onLoadMore, onHeart,
}: FeedListProps) {
  const styles = makeStyles();
  const { data: artRaw } = useArtFeed();
  const broken = useBrokenArt((s) => s.broken);
  // Strip already-known-broken pieces from the pool the feed sees so
  // banner / inline / sidebar all converge on working images.
  const art = useMemo(() =>
    (artRaw ?? []).filter((w) => !broken.has(w.id)),
    [artRaw, broken],
  );
  const feedMix = useArtPrefs((s) => s.feedMix);
  const showBetweenSlots = feedMix !== 'posts_only';

  // News rides in the For You tab only. Connections is people the owner
  // picked; a wire story has no business in that column.
  const activeTab = useFeedStore((s) => s.activeTab);

  // The chip row drives which sources reach the column.
  //
  // Only the three single-source values narrow the stream. Everything
  // else, including an undefined filter from a store that has not been
  // migrated yet, falls through to the mixed path and renders exactly
  // what this list rendered before the chips existed.
  const filter = useFeedStore((s) => s.filter);
  const onlyLoft = filter === 'public';
  const onlyNews = filter === 'news';
  const onlyDrops = filter === 'drops';
  const single = onlyLoft || onlyNews || onlyDrops;
  const crewOnly = filter === 'crew';
  const mixed = !single && !crewOnly;

  const postsAllowed = !single;
  const loftAllowed = onlyLoft || mixed;
  const dropsAllowed = onlyDrops || mixed;
  const newsAllowed = onlyNews || (mixed && activeTab === 'for_you');

  // Additive by construction. While a query is loading, and if it
  // errors, `data` is undefined, the pool collapses to empty, and the
  // post stream below renders exactly as it would with the feature
  // absent. Nothing here can block or throw into the post path.
  const { data: newsRaw, isLoading: newsLoading, refetch: refetchNews } = useNewsFeed();
  const { data: loftRaw, isLoading: loftLoading, refetch: refetchLoft } = useLoftFeed();
  const { data: dropsRaw, isLoading: dropsLoading, refetch: refetchDrops } = usePublicHuntCaches();

  const news = useMemo<NewsItem[]>(() => {
    if (!newsAllowed || !Array.isArray(newsRaw)) return [];
    return newsRaw
      .filter((n) => !!n?.id && !!n.url && !!n.headline && ms(n.published_at) > 0)
      .slice()
      // Newest first, ties broken by id so the order is total and the
      // same input can never produce two different arrangements.
      .sort((a, b) => (ms(b.published_at) - ms(a.published_at)) || a.id.localeCompare(b.id));
  }, [newsRaw, newsAllowed]);

  const loft = useMemo<LoftPost[]>(() => {
    if (!loftAllowed || !Array.isArray(loftRaw)) return [];
    return loftRaw
      // Expiry is left alone on purpose. RLS already hides dead rows, and
      // reading the clock here would make this builder impure.
      .filter((p) => !!p?.id && !!p.body && !!p.pseudonym && ms(p.created_at) > 0)
      .slice()
      .sort((a, b) => (ms(b.created_at) - ms(a.created_at)) || a.id.localeCompare(b.id));
  }, [loftRaw, loftAllowed]);

  const drops = useMemo<HuntCache[]>(() => {
    if (!dropsAllowed || !Array.isArray(dropsRaw)) return [];
    return dropsRaw
      // No share code means /hunt/{code} has nowhere to land. A card that
      // cannot open is worse than one that never rendered.
      .filter((c) => !!c?.id && !!c.share_code && ms(c.created_at) > 0)
      .slice()
      .sort((a, b) => (ms(b.created_at) - ms(a.created_at)) || a.id.localeCompare(b.id));
  }, [dropsRaw, dropsAllowed]);

  // Interleave: post, art (right after the first post), then more art
  // every ART_INTERVAL after that.
  //
  // Anchor distribution (so we never repeat across the screen):
  //   idx 0           → top banner
  //   idx length-1    → bottom banner
  //   idx length/2    → desktop sidebar
  //   idx 1, 2, 3...  → inline slots (so they're guaranteed different
  //                     from banner picks as long as pool is large enough)
  //
  // Secondary merge (news, loft, drops):
  //   - Every stream is walked newest-first and a card is placed at the
  //     point where its timestamp falls below the posts above it, so the
  //     column still reads reverse-chronologically.
  //   - A card is pushed BEFORE the post it precedes. A post always lands
  //     under it, and only one card may take any single gap, so two
  //     secondary cards can never sit adjacent.
  //   - Each rail's `since` starts at 0 and its gate needs NEWS_EVERY, so
  //     the first four posts run clean. The feed can never open on news,
  //     on a stranger, or on a drop.
  //   - Pure function of (posts, news, loft, drops). No Math.random, no
  //     Date.now, no mutation of any input. Same inputs, same array,
  //     every render.
  const items = useMemo<FeedItem[]>(() => {
    // Single-source views. Full density, newest first, no cap. These
    // replace the /loft and /news rooms outright, so every row the
    // source returns has to land here.
    if (onlyLoft) return loft.map((l): FeedItem => ({ kind: 'loft', loft: l }));
    if (onlyNews) return news.map((n): FeedItem => ({ kind: 'news', news: n }));
    if (onlyDrops) return drops.map((d): FeedItem => ({ kind: 'drop', drop: d }));

    const out: FeedItem[] = [];
    const haveArt = !!art && art.length > 0 && showBetweenSlots && postsAllowed;
    let inlineIdx = 1; // start AFTER the top banner's index 0

    let oldestPostSeen = Number.POSITIVE_INFINITY;

    // Fixed order is the tie-break when several rails are ready at once.
    // The one that places a card resets its own counter, so the others
    // take the next gaps rather than starving.
    const rails: Rail[] = [
      { list: news, at: 0, since: 0, time: (n: NewsItem) => ms(n.published_at), make: (n: NewsItem) => ({ kind: 'news', news: n }) },
      { list: loft, at: 0, since: 0, time: (l: LoftPost) => ms(l.created_at), make: (l: LoftPost) => ({ kind: 'loft', loft: l }) },
      { list: drops, at: 0, since: 0, time: (d: HuntCache) => ms(d.created_at), make: (d: HuntCache) => ({ kind: 'drop', drop: d }) },
    ];

    posts.forEach((p, i) => {
      const postMs = ms(p.created_at);

      // This slot sits below every post already emitted, so anything
      // stamped at or after that floor belongs here. Taking the min
      // keeps the boundary monotonic even though For You is ordered by
      // unifying score rather than strict recency. Without it a single
      // out-of-order post could wedge every pointer.
      const boundary = Math.min(oldestPostSeen, postMs);

      for (const rail of rails) {
        if (rail.since < NEWS_EVERY) continue;
        if (rail.at >= rail.list.length) continue;
        const row = rail.list[rail.at];
        if (rail.time(row) < boundary) continue;
        out.push(rail.make(row));
        rail.at++;
        rail.since = 0;
        break; // one non-crew card per gap, hard stop
      }

      out.push({ kind: 'post', post: p });
      for (const rail of rails) rail.since++;
      oldestPostSeen = Math.min(oldestPostSeen, postMs);

      const idx1 = i + 1;
      const shouldSlot =
        haveArt && (
          idx1 === FIRST_ART_AT
          || (idx1 > FIRST_ART_AT && (idx1 - FIRST_ART_AT) % ART_INTERVAL === 0)
        );
      if (shouldSlot && art) {
        // Skip the indices reserved for banner-bottom and sidebar.
        const reserved = new Set([
          art.length - 1,                   // bottom banner
          Math.floor(art.length / 2),       // sidebar
        ]);
        while (reserved.has(inlineIdx) && inlineIdx < art.length - 1) inlineIdx++;
        out.push({ kind: 'art', art: art[inlineIdx % art.length], slot: inlineIdx });
        inlineIdx++;
      }
    });
    // If the feed is empty but we have art, show one piece anyway.
    // No secondary source is offered here. With no posts there is
    // nothing for it to trail, and it would be leading the feed.
    if (posts.length === 0 && haveArt && art) {
      out.push({ kind: 'art', art: art[1] ?? art[0], slot: 0 });
    }
    return out;
  }, [posts, art, showBetweenSlots, news, loft, drops, onlyLoft, onlyNews, onlyDrops, postsAllowed]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'post') return <PostCard post={item.post} onHeart={onHeart} />;
      if (item.kind === 'news') return <NewsCard item={item.news} />;
      if (item.kind === 'loft') return <LoftCard post={item.loft} />;
      if (item.kind === 'drop') return <DropCard cache={item.drop} />;
      return <ArtSlot art={item.art} />;
    },
    [onHeart],
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    if (item.kind === 'post') return `post:${item.post.id}`;
    if (item.kind === 'news') return `news:${item.news.id}`;
    if (item.kind === 'loft') return `loft:${item.loft.id}`;
    if (item.kind === 'drop') return `drop:${item.drop.id}`;
    return `art:${item.slot}:${item.art.id}`;
  }, []);

  // Pull-to-refresh has to reach whatever the column is actually
  // showing. The post refetch still drives the spinner; the secondary
  // refetches are fire-and-forget and their rejections stay swallowed
  // so they can never surface in the post path.
  const handleRefresh = useCallback(() => {
    onRefresh();
    if (newsAllowed) void refetchNews().catch(() => {});
    if (loftAllowed) void refetchLoft().catch(() => {});
    if (dropsAllowed) void refetchDrops().catch(() => {});
  }, [
    onRefresh, newsAllowed, loftAllowed, dropsAllowed,
    refetchNews, refetchLoft, refetchDrops,
  ]);

  // In a single-source view the post query says nothing about whether
  // there is anything to show. Gate on the source being rendered, or a
  // news-only column with an empty crew feed would report Empty while
  // holding sixty headlines.
  const gateLoading =
    onlyLoft ? loftLoading
    : onlyNews ? newsLoading
    : onlyDrops ? dropsLoading
    : isLoading;
  const gateEmpty = single ? items.length === 0 : posts.length === 0;

  // Art chrome belongs to the mixed and crew columns. A single-source
  // view stays pure.
  const showArtChrome = showBetweenSlots && !single;

  if (gateLoading && gateEmpty) {
    return (
      <View style={styles.center}>
        <FeedComposer />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!gateLoading && gateEmpty) {
    return (
      <View style={{ flex: 1 }}>
        <FeedComposer />
        {/* A fragment, not an instruction. Without it a loaded-empty feed
            is indistinguishable from one that failed to load. */}
        <View style={styles.center}>
          <Text style={styles.empty}>Empty.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/*
        Banners and composer are siblings of the list, not its
        ListHeaderComponent. FlashList's header receives a new render
        prop on every parent re-render, which on RN-Web can wedge the
        layout when the child has an aspectRatio-driven height. As a
        sibling View the banner measures once and stays stable.

        When feedMix === 'posts_only' we skip the banner entirely.
      */}
      {showArtChrome && <ArtBanner slot="top" />}
      <FeedComposer />
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Five shapes ride this list now. Typing them keeps FlashList
        // recycling a post view into a post view.
        getItemType={itemType}
        ListFooterComponent={showArtChrome ? ListFooter : undefined}
        // Pagination belongs to the post query. A single-source column
        // has no more posts to ask for.
        onEndReached={!single && hasMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

// Module-scope so FlashList sees a stable reference instead of a fresh
// inline arrow on every parent render.
function ListFooter() {
  return <ArtBanner slot="bottom" />;
}

function itemType(item: FeedItem) {
  return item.kind;
}

function makeStyles() { return StyleSheet.create({
  list: { paddingBottom: 80 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, minHeight: 200,
  },
  empty: { fontSize: 14, color: Colors.textMuted },
}); }
