import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl, Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { ArtSlot } from './ArtSlot';
import { ArtBanner } from './ArtBanner';
import { NewsCard } from './NewsCard';
import { LoftCard } from './LoftCard';
import { FeedComposer } from './FeedComposer';
import { useArtFeed, type ArtWork } from '../../hooks/useArtFeed';
import { useNewsFeed, type NewsItem } from '../../hooks/useNews';
import { useLoftFeed, type LoftPost } from '../../hooks/useLoft';
import { useArtPrefs } from '../../stores/artPrefsStore';
import { useBrokenArt } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Shadow, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';
import { useFeedStore, type Post } from '../../stores/feedStore';

/**
 * Above this the column has room beside it for a floating control.
 * Below it the tab bar already carries composing, so a second control
 * would be one too many.
 */
const WIDE_VIEWPORT = 768;

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
  | { kind: 'loft'; loft: LoftPost };

// One secondary card after every this many posts: news, loft, a drop, or an
// inline art piece. The active sources take these slots round-robin, so the
// wire, the loft, the drops, and the art each get an even share of the column
// and none can bury the crew. A post always brackets a secondary card, so two
// never sit adjacent and the feed never opens on one. This is the single knob
// to turn. Smaller packs side content tighter. Larger spreads it out. Roughly
// one secondary card per three to four posts reads as even.
const SECONDARY_EVERY = 3;

/** Epoch ms, 0 for anything unparseable. Never throws. */
function ms(iso: string | null | undefined): number {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
}

export function FeedList({
  posts, isLoading, isRefreshing, hasMore, onRefresh, onLoadMore, onHeart,
}: FeedListProps) {
  const styles = makeStyles();
  // Floating compose. Wide viewports only. Each tap bumps the counter and
  // the composer at the top of the column opens on the change.
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_VIEWPORT;
  const [composeSignal, setComposeSignal] = useState(0);
  const fab = wide ? (
    <Pressable
      style={styles.fab}
      onPress={() => setComposeSignal((n) => n + 1)}
      accessibilityRole="button"
      accessibilityLabel={`New ${Vocab.post}`}
    >
      <Ionicons name="create-outline" size={22} color={Colors.onPrimary} />
    </Pressable>
  ) : null;
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
  const loftAllowed = onlyLoft || onlyDrops || mixed;
  const newsAllowed = onlyNews || (mixed && activeTab === 'for_you');

  // Additive by construction. While a query is loading, and if it
  // errors, `data` is undefined, the pool collapses to empty, and the
  // post stream below renders exactly as it would with the feature
  // absent. Nothing here can block or throw into the post path.
  const { data: newsRaw, isLoading: newsLoading, refetch: refetchNews } = useNewsFeed();
  const { data: loftRaw, isLoading: loftLoading, refetch: refetchLoft } = useLoftFeed();

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

  // Interleave the crew's posts with the side sources on an even positional
  // cadence.
  //
  //   - Posts stream in their ranked order, untouched.
  //   - After every SECONDARY_EVERY posts one secondary card drops in: news,
  //     loft, a drop, or an inline art piece, chosen round-robin so the
  //     sources share the column evenly. No timestamp gate, so a ranked feed
  //     of recent posts can no longer starve the older wire.
  //   - The rotation steps over a source that is empty or spent and hands the
  //     slot to the next one with something to show, so a quiet source never
  //     costs a slot. Art wraps instead of running dry, so it backs the
  //     cadence once the wire and the loft are spent.
  //   - Each source walks newest-first (news/loft/drops are pre-sorted above;
  //     art starts past the top banner), so the freshest item of each shows
  //     first.
  //   - A post sits on both sides of every secondary card. Two secondary
  //     cards can never touch, and the first SECONDARY_EVERY posts run clean,
  //     so the feed never opens on a non-post.
  //   - Pure function of (posts, news, loft, drops, art). No Math.random, no
  //     Date.now, no mutation of any input. The only mutable state is the
  //     local pointers below, so the same inputs yield the same array every
  //     render and nothing reshuffles under a scroll.
  //   - Card k's source depends only on the cards before it, so appending
  //     page 2 leaves page 1's cards exactly where they were.
  const items = useMemo<FeedItem[]>(() => {
    // Single-source views. Full density, newest first, no cap.
    //
    // The Public lens is everything public: named public posts (the
    // submits and drops the composer writes there since migration 074)
    // interleaved with the loft's pseudonymous cards, one stream,
    // newest first. Before this it showed the loft alone, and a person
    // who posted publicly could not find their own post under the chip
    // that said Public.
    if (onlyLoft) {
      const pub: FeedItem[] = posts
        .filter((p) => p.visibility === 'public')
        .map((p): FeedItem => ({ kind: 'post', post: p }));
      const anon: FeedItem[] = loft.map((l): FeedItem => ({ kind: 'loft', loft: l }));
      return [...pub, ...anon].sort((a, b) => {
        const ta = a.kind === 'post' ? ms(a.post.created_at) : ms((a as any).loft.created_at);
        const tb = b.kind === 'post' ? ms(b.post.created_at) : ms((b as any).loft.created_at);
        return tb - ta;
      });
    }
    if (onlyNews) return news.map((n): FeedItem => ({ kind: 'news', news: n }));
    // The Drops lens is every LIVE drop the viewer can see, wherever it
    // was sent: ephemeral posts (expires_at set — RLS already dropped the
    // expired ones) plus the loft, whose every card is a 24-hour public
    // drop by construction. The GPS game is NOT this — Deaddrop lives at
    // /hunt and its only feed presence is the X announcement card.
    if (onlyDrops) {
      const eph: FeedItem[] = posts
        // Cohort or public only. DMs never ride the feed at all any
        // more, but the guard stays so a future stream change cannot
        // leak a private drop into a lens.
        .filter((p) => !!(p as any).expires_at && (p.visibility as string) !== 'direct')
        .map((p): FeedItem => ({ kind: 'post', post: p }));
      const anon: FeedItem[] = loft.map((l): FeedItem => ({ kind: 'loft', loft: l }));
      return [...eph, ...anon].sort((a, b) => {
        const ta = a.kind === 'post' ? ms(a.post.created_at) : ms((a as any).loft.created_at);
        const tb = b.kind === 'post' ? ms(b.post.created_at) : ms((b as any).loft.created_at);
        return tb - ta;
      });
    }

    const out: FeedItem[] = [];
    const haveArt = art.length > 0 && showBetweenSlots && postsAllowed;

    // Per-source pointers. The only mutable state in this memo, and it never
    // escapes it.
    let ni = 0, li = 0, ai = 0;

    // Fixed rotation order. `ready` reports whether the source can place a
    // card at its pointer; `place` builds it and advances. Art reports ready
    // whenever its pool is non-empty and wraps, so it can repeat.
    const sources: { ready: () => boolean; place: () => FeedItem }[] = [
      { ready: () => ni < news.length, place: () => ({ kind: 'news', news: news[ni++] }) },
      { ready: () => li < loft.length, place: () => ({ kind: 'loft', loft: loft[li++] }) },
      {
        ready: () => haveArt,
        place: () => {
          // The running count is the slot. It keeps the key unique when the
          // pool wraps and stable so pagination never renumbers a piece
          // already on screen. Start past index 0 so an inline piece does
          // not echo the top banner while the pool has room.
          const slot = ai++;
          const idx = art.length > 1 ? (slot + 1) % art.length : 0;
          return { kind: 'art', art: art[idx], slot };
        },
      },
    ];
    const N = sources.length;
    let turn = 0;

    // Fill one secondary slot. Scan from the current turn and take the first
    // source with something to show, so an empty or spent source is stepped
    // over rather than left a hole. If every source is spent the slot simply
    // carries no card.
    const fillSlot = () => {
      for (let off = 0; off < N; off++) {
        const s = sources[(turn + off) % N];
        if (s.ready()) {
          out.push(s.place());
          turn = (turn + off + 1) % N;
          return;
        }
      }
    };

    posts.forEach((p, i) => {
      out.push({ kind: 'post', post: p });
      // Positional cadence. One secondary card after every SECONDARY_EVERY
      // posts. The first SECONDARY_EVERY posts run clean and a post always
      // brackets each secondary card.
      if ((i + 1) % SECONDARY_EVERY === 0) fillSlot();
    });

    // If the feed is empty but we have art, show one piece anyway.
    // No secondary source is offered here. With no posts there is
    // nothing for it to trail, and it would be leading the feed.
    if (posts.length === 0 && haveArt) {
      out.push({ kind: 'art', art: art[1] ?? art[0], slot: 0 });
    }
    return out;
  }, [posts, art, showBetweenSlots, news, loft, onlyLoft, onlyNews, onlyDrops, postsAllowed]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'post') return <PostCard post={item.post} onHeart={onHeart} />;
      if (item.kind === 'news') return <NewsCard item={item.news} />;
      if (item.kind === 'loft') return <LoftCard post={item.loft} />;
      return <ArtSlot art={item.art} />;
    },
    [onHeart],
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    if (item.kind === 'post') return `post:${item.post.id}`;
    if (item.kind === 'news') return `news:${item.news.id}`;
    if (item.kind === 'loft') return `loft:${item.loft.id}`;
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
  }, [
    onRefresh, newsAllowed, loftAllowed,
    refetchNews, refetchLoft,
  ]);

  // In a single-source view the post query says nothing about whether
  // there is anything to show. Gate on the source being rendered, or a
  // news-only column with an empty crew feed would report Empty while
  // holding sixty headlines.
  const gateLoading =
    onlyLoft ? loftLoading
    : onlyNews ? newsLoading
    : onlyDrops ? isLoading
    : isLoading;
  const gateEmpty = single ? items.length === 0 : posts.length === 0;

  // Art chrome belongs to the mixed and crew columns. A single-source
  // view stays pure.
  const showArtChrome = showBetweenSlots && !single;

  if (gateLoading && gateEmpty) {
    return (
      <View style={styles.center}>
        <FeedComposer openSignal={composeSignal} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
        {fab}
      </View>
    );
  }

  if (!gateLoading && gateEmpty) {
    return (
      <View style={{ flex: 1 }}>
        <FeedComposer openSignal={composeSignal} />
        {/* A fragment, not an instruction. Without it a loaded-empty feed
            is indistinguishable from one that failed to load. */}
        <View style={styles.center}>
          <Text style={styles.empty}>Empty.</Text>
        </View>
        {fab}
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
      <FeedComposer openSignal={composeSignal} />
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
      {fab}
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
  empty: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textMuted,
  },
  // The one shadow in the product.
  fab: {
    position: 'absolute',
    right: Spacing.lg, bottom: Spacing.lg,
    width: 56, height: 56, borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...(Shadow.float as object),
  },
}); }
