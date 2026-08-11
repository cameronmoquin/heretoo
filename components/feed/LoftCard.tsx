/**
 * LoftCard: one pseudonymous public post sitting inline in the crew feed.
 *
 * Same row treatment as a person's drop: full column width, 16 of
 * padding, one hairline along the bottom. No fill, no acid rail, no
 * kicker. A small muted "Anon" label and the pseudonym mark it as a
 * stranger, and there is no avatar and no action row.
 *
 * The countdown is data. Every loft post dies at 24 hours.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeleteLoftPost, type LoftPost } from '../../hooks/useLoft';
import { useAuthStore } from '../../stores/authStore';
import { showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Layout, Spacing, Type } from '../../constants/design';

interface LoftCardProps {
  post: LoftPost;
}

export function LoftCard({ post }: LoftCardProps) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const remove = useDeleteLoftPost();
  // The square never hands out its authors (087). The view answers.
  const isMine = !!post.is_mine;
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
      style={s.row}
      accessibilityLabel={
        left
          ? `Anonymous post by ${post.pseudonym}, ${left}`
          : `Anonymous post by ${post.pseudonym}`
      }
    >
      <View style={s.metaRow}>
        <Text style={s.kind}>Anon</Text>
        <Text style={s.dot}>·</Text>
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
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      <Text style={s.text}>{post.body}</Text>
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
  row: {
    paddingHorizontal: Layout.rowPaddingHorizontal,
    paddingVertical: Layout.rowPaddingVertical,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xxs,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The kind label. Restraint does the work a colored rail used to.
  kind: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  dot: { fontSize: Type.caption.size, color: Colors.textMuted },
  pseudonym: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, flexShrink: 1,
  },
  expires: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
  text: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    fontWeight: Type.body.weight,
    color: Colors.textPrimary,
  },
}); }
