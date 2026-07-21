import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { ArtSlot } from './ArtSlot';
import { ArtBanner } from './ArtBanner';
import { NewsCard } from './NewsCard';
import { FeedComposer } from './FeedComposer';
import { useArtFeed, type ArtWork } from '../../hooks/useArtFeed';
import { useNewsFeed, type NewsItem } from '../../hooks/useNews';
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
  | { kind: 'news'; news: NewsItem };

const ART_INTERVAL = 6;       // a new piece every N posts after the first slot
const FIRST_ART_AT = 1;       // show the first art piece right after the very first post

// Density cap. RSS publishes hundreds of items a day; a crew publishes a
// handful. Ungated, the wire buries the people. One news item per this
// many posts, hard ceiling.
const NEWS_EVERY = 4;

/** Epoch ms, 0 for anything unparseable. Never throws. */
function ms(iso: string | null | undefined): number {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
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
  const newsAllowed = activeTab === 'for_you';

  // Additive by construction. While the query is loading, and if it
  // errors, `data` is undefined — the pool collapses to empty and the
  // post stream below renders exactly as it would with no news feature
  // at all. Nothing here can block or throw into the post path.
  const { data: newsRaw } = useNewsFeed();
  const news = useMemo<NewsItem[]>(() => {
    if (!newsAllowed || !Array.isArray(newsRaw)) return [];
    return newsRaw
      .filter((n) => !!n?.id && !!n.url && !!n.headline && ms(n.published_at) > 0)
      .slice()
      // Newest first, ties broken by id so the order is total and the
      // same input can never produce two different arrangements.
      .sort((a, b) => (ms(b.published_at) - ms(a.published_at)) || a.id.localeCompare(b.id));
  }, [newsRaw, newsAllowed]);

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
  // News merge (For You only):
  //   - Both streams are walked newest-first and a news item is placed
  //     at the point where its published_at falls below the posts above
  //     it, so the column still reads reverse-chronologically.
  //   - A news item is pushed BEFORE the post it precedes. A post always
  //     lands under it, which makes two adjacent news items structurally
  //     impossible.
  //   - `postsSinceNews` starts at 0 and the gate needs NEWS_EVERY, so
  //     the first four posts run clean. The feed can never open on news.
  //   - Pure function of (posts, news). No Math.random, no Date.now, no
  //     mutation of either input. Same inputs, same array, every render.
  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    const haveArt = !!art && art.length > 0 && showBetweenSlots;
    let inlineIdx = 1; // start AFTER the top banner's index 0

    let newsIdx = 0;
    let postsSinceNews = 0;
    let oldestPostSeen = Number.POSITIVE_INFINITY;

    posts.forEach((p, i) => {
      const postMs = ms(p.created_at);

      if (postsSinceNews >= NEWS_EVERY && newsIdx < news.length) {
        // This slot sits below every post already emitted, so anything
        // published at or after that floor belongs here. Taking the min
        // keeps the boundary monotonic even though For You is ordered by
        // unifying score rather than strict recency — without it a
        // single out-of-order post could wedge the news pointer.
        const boundary = Math.min(oldestPostSeen, postMs);
        if (ms(news[newsIdx].published_at) >= boundary) {
          out.push({ kind: 'news', news: news[newsIdx] });
          newsIdx++;
          postsSinceNews = 0;
        }
      }

      out.push({ kind: 'post', post: p });
      postsSinceNews++;
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
    // News is not offered here — with no posts there is nothing for it
    // to trail, and it would be leading the feed.
    if (posts.length === 0 && haveArt && art) {
      out.push({ kind: 'art', art: art[1] ?? art[0], slot: 0 });
    }
    return out;
  }, [posts, art, showBetweenSlots, news]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'post') return <PostCard post={item.post} onHeart={onHeart} />;
      if (item.kind === 'news') return <NewsCard item={item.news} />;
      return <ArtSlot art={item.art} />;
    },
    [onHeart],
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    if (item.kind === 'post') return `post:${item.post.id}`;
    if (item.kind === 'news') return `news:${item.news.id}`;
    return `art:${item.slot}:${item.art.id}`;
  }, []);

  if (isLoading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <FeedComposer />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!isLoading && posts.length === 0) {
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
      {showBetweenSlots && <ArtBanner slot="top" />}
      <FeedComposer />
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListFooterComponent={showBetweenSlots ? ListFooter : undefined}
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
    </View>
  );
}

// Module-scope so FlashList sees a stable reference instead of a fresh
// inline arrow on every parent render.
function ListFooter() {
  return <ArtBanner slot="bottom" />;
}

function makeStyles() { return StyleSheet.create({
  list: { paddingBottom: 80 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, minHeight: 200,
  },
  empty: { fontSize: 14, color: Colors.textMuted },
}); }
