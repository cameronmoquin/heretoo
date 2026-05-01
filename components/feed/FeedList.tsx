import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PostCard } from './PostCard';
import { ArtSlot } from './ArtSlot';
import { ArtBanner } from './ArtBanner';
import { FeedComposer } from './FeedComposer';
import { useArtFeed, type ArtWork } from '../../hooks/useArtFeed';
import { useArtPrefs } from '../../stores/artPrefsStore';
import { useBrokenArt } from '../../stores/brokenArtStore';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import type { Post } from '../../stores/feedStore';

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
  | { kind: 'art'; art: ArtWork };

const ART_INTERVAL = 6;       // a new piece every N posts after the first slot
const FIRST_ART_AT = 1;       // show the first art piece right after the very first post

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

  // Interleave: post, art (right after the first post), then more art
  // every ART_INTERVAL after that.
  //
  // Anchor distribution (so we never repeat across the screen):
  //   idx 0           → top banner
  //   idx length-1    → bottom banner
  //   idx length/2    → desktop sidebar
  //   idx 1, 2, 3...  → inline slots (so they're guaranteed different
  //                     from banner picks as long as pool is large enough)
  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    const haveArt = !!art && art.length > 0 && showBetweenSlots;
    let inlineIdx = 1; // start AFTER the top banner's index 0
    posts.forEach((p, i) => {
      out.push({ kind: 'post', post: p });
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
        out.push({ kind: 'art', art: art[inlineIdx % art.length] });
        inlineIdx++;
      }
    });
    // If the feed is empty but we have art, show one piece anyway.
    if (posts.length === 0 && haveArt && art) {
      out.push({ kind: 'art', art: art[1] ?? art[0] });
    }
    return out;
  }, [posts, art, showBetweenSlots]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'post') return <PostCard post={item.post} onHeart={onHeart} />;
      return <ArtSlot art={item.art} />;
    },
    [onHeart],
  );

  const keyExtractor = useCallback((item: FeedItem) => {
    return item.kind === 'post' ? `post:${item.post.id}` : `art:${item.art.id}`;
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
        <View style={styles.center}>
          <Text style={styles.empty}>Nothing to see yet. Make the first post.</Text>
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
  empty: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
}); }
