/**
 * Postcard — a single recent post rendered for the Room's mantel.
 *
 * Two variants:
 *   - image-dominant: 60% image, 40% type below. For posts with media.
 *   - type-dominant: a pulled phrase from the body in Syne 600 32px,
 *     thin author byline below. For text-only posts.
 *
 * The variant is chosen at the call site based on whether the post
 * has media of acceptable resolution; the postcard itself just
 * renders. Tapping a postcard opens the full post detail.
 *
 * Refusal list (Source of Truth, M1):
 *   - No "trending" indicator
 *   - No view count
 *   - No "X new posts" badge
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTTS } from '../../stores/ttsStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface PostLike {
  id: string;
  body?: string | null;
  created_at?: string;
  media?: Array<{ path: string }> | null;
  author?: {
    id?: string;
    handle?: string | null;
    display_name?: string | null;
    avatar_path?: string | null;
  } | null;
}

interface Props {
  post: PostLike;
  variant?: 'image-dominant' | 'type-dominant' | 'auto';
}

/** Pull a 1–3 line phrase from a post body to use as the type-dominant
 *  hero. Prefers the first sentence; if very short, includes the second.
 *  Caps around 140 chars so the type stays large and readable. */
function pullPhrase(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 140) return trimmed;
  // First sentence
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed;
  if (firstSentence.length >= 60 && firstSentence.length <= 200) {
    return firstSentence;
  }
  // Otherwise truncate at a word boundary near 140
  const slice = trimmed.slice(0, 140);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 60 ? slice.slice(0, lastSpace) : slice) + '…';
}

function authorLabel(post: PostLike): string {
  return post.author?.display_name || post.author?.handle || 'Someone';
}

export function Postcard({ post, variant = 'auto' }: Props) {
  const s = makeStyles();
  const tts = useTTS();
  const ttsActive = tts.currentId === post.id && tts.playing;

  const hasMedia = (post.media ?? []).length > 0;
  const resolvedVariant: 'image-dominant' | 'type-dominant' =
    variant === 'auto' ? (hasMedia ? 'image-dominant' : 'type-dominant') : variant;

  // Use the explicit (tabs)/feed form so Expo Router resolves
  // unambiguously across the codebase. The URL bar still shows
  // /feed/{id} because (tabs) is a route group.
  const open = () => router.push(`/(tabs)/feed/${post.id}` as any);

  const onReadAloud = (e: any) => {
    e.stopPropagation?.();
    if (post.body) tts.toggle(post.id, post.body);
  };

  // Image-dominant — 60% image up top, 40% type strip below.
  if (resolvedVariant === 'image-dominant' && hasMedia) {
    const imageUrl = mediaPathToUrl(post.media![0].path);
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={open} style={s.cardWrap}>
        <View style={s.cardImg}>
          <Image source={{ uri: imageUrl }} style={s.img} resizeMode="cover" />
          {!!post.body && (
            <View style={s.imgScrim} pointerEvents="none">
              <Text style={s.imgScrimText} numberOfLines={3}>{pullPhrase(post.body)}</Text>
            </View>
          )}
        </View>
        <View style={s.byline}>
          <Text style={s.bylineAuthor}>{authorLabel(post)}</Text>
          {!!post.body && (
            <TouchableOpacity onPress={onReadAloud} style={s.ttsBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={ttsActive ? 'pause' : 'volume-medium-outline'}
                size={16}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Type-dominant — a pulled phrase as hero, byline below. Rendered
  // like a small framed broadside: a thin gold inner border, a big
  // pulled quote in Source Serif italic with an opening curly quote
  // standing tall in the upper-left corner.
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={open} style={s.cardWrap}>
      <View style={s.cardType}>
        <View style={s.typeFrame} pointerEvents="none" />
        <Text style={s.openQuote} accessibilityLabel="">"</Text>
        <Text style={s.typeHero} numberOfLines={5}>
          {post.body ? pullPhrase(post.body) : '(empty post)'}
        </Text>
      </View>
      <View style={s.byline}>
        <Text style={s.bylineAuthor}>— {authorLabel(post)}</Text>
        {!!post.body && (
          <TouchableOpacity onPress={onReadAloud} style={s.ttsBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons
              name={ttsActive ? 'pause' : 'volume-medium-outline'}
              size={16}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  cardWrap: {
    width: '100%',
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.78)',
    borderWidth: 1,
    borderColor: Colors.primary,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  cardImg: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.surfaceLight,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    // Subtle bottom-up gradient via solid alpha — RN doesn't ship gradients
    // out of the box. Soft enough to keep the image readable above.
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  imgScrimText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  cardType: {
    position: 'relative',
    paddingHorizontal: Spacing.lg + 4,
    paddingVertical: Spacing.xl,
    minHeight: 180,
    justifyContent: 'center',
  },
  // Inner gold hairline 12px in from the outer border — a paper-mounted
  // print look, not a flat web card.
  typeFrame: {
    position: 'absolute',
    top: 12, left: 12, right: 12, bottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.primary,
    opacity: 0.35,
    borderRadius: 6,
  },
  // Oversized opening quote — the hand-set look of a broadside.
  openQuote: {
    position: 'absolute',
    top: 4, left: 14,
    fontSize: 70,
    lineHeight: 70,
    color: Colors.primary,
    opacity: 0.55,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  typeHero: {
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '400',
    fontStyle: 'italic',
    // textPrimary not brandIvory — brandIvory disappears on the
    // warm parchment canvas in light mode.
    color: Colors.textPrimary,
    letterSpacing: 0,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.primary,
  },
  bylineAuthor: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    flexShrink: 1,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  ttsBtn: {
    width: 28, height: 28, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
