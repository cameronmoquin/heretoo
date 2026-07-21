/**
 * LoftCard: one pseudonymous public post sitting inline in the crew feed.
 *
 * These are strangers. The card says so before it says anything else.
 * An ANON chip in the Loft's locked acid yellow, the pseudonym as the
 * byline, no avatar, and an acid rule down the left edge.
 *
 * NewsCard separates itself from PostCard by sinking into a recessed
 * canvas behind a colored rule. This uses the same device with its own
 * color, so the stream reads as three distinct rails: crew lifts, wire
 * sinks gold, loft sinks acid.
 *
 * The countdown is data. Every loft post dies at 24 hours.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeleteLoftPost, type LoftPost } from '../../hooks/useLoft';
import { useAuthStore } from '../../stores/authStore';
import { showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';

// The Loft's identity color. Locked, never theme-driven, same value the
// Loft screen used. It is the one hue in the feed that belongs to no
// part of the house palette, which is the point.
const ACID = '#E0FF4F';
const ACID_INK = '#0E0E0E';

interface LoftCardProps {
  post: LoftPost;
}

export function LoftCard({ post }: LoftCardProps) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const remove = useDeleteLoftPost();
  const isMine = !!userId && post.author_id === userId;
  const left = timeLeft(post.expires_at);

  const onDelete = () => {
    showConfirm(
      'Delete post?',
      'This cannot be undone.',
      () => remove.mutate(post.id),
      'Delete',
      'Cancel',
    );
  };

  return (
    <View
      style={s.card}
      accessibilityLabel={
        left
          ? `Anonymous post by ${post.pseudonym}, ${left}`
          : `Anonymous post by ${post.pseudonym}`
      }
    >
      <View style={s.rule} pointerEvents="none" />

      <View style={s.body}>
        <View style={s.metaRow}>
          <View style={s.tag}>
            <Text style={s.tagText}>ANON</Text>
          </View>
          <Text style={s.pseudonym} numberOfLines={1}>
            {post.pseudonym}
          </Text>
          <View style={{ flex: 1 }} />
          {!!left && <Text style={s.expires}>{left}</Text>}
          {isMine && (
            <Pressable
              onPress={onDelete}
              disabled={remove.isPending}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Delete your post"
              style={remove.isPending ? { opacity: 0.4 } : undefined}
            >
              <Ionicons name="trash-outline" size={13} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>

        <Text style={s.text}>{post.body}</Text>
      </View>
    </View>
  );
}

/** Time until the hard 24h expiry. Empty string for an unparseable stamp. */
function timeLeft(iso: string | null | undefined): string {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return '';
  const m = Math.floor((t - Date.now()) / 60000);
  if (m <= 0) return 'gone';
  if (m < 60) return `${m}m left`;
  return `${Math.floor(m / 60)}h left`;
}

function makeStyles() { return StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingLeft: Spacing.md + 3,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  rule: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: ACID,
    opacity: 0.85,
  },
  body: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Filled chip rather than colored text: acid on ink reads at full
  // contrast in both themes, and a chip beside a name cannot be
  // mistaken for the name itself.
  tag: {
    backgroundColor: ACID,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ACID_INK,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  // Lowercase, muted, tracked out. Crew display names are ivory and
  // sit next to an avatar; this reads as a handle in a different room.
  pseudonym: {
    fontSize: Type.caption.size,
    lineHeight: Type.caption.lineHeight,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'lowercase',
    color: Colors.textSecondary,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
  expires: {
    fontSize: 10, fontWeight: '600', letterSpacing: 0.6,
    textTransform: 'uppercase', color: Colors.textMuted,
  },
  text: {
    fontSize: 15, lineHeight: 22, fontWeight: '400',
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
}); }
