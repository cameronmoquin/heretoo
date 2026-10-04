/**
 * PostCard — one board post: author, department, time, body, photo,
 * comment count. Announcements carry a small label and a hairline box.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Eyebrow } from '../../shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { BoardPost } from '../../../lib/nffga/types';
import { publicObjectUrl } from '../../../lib/nffga/types';
import { relativeTime } from '../../../lib/nffga/board';
import { PostPhotos } from './PostPhoto';

export function AuthorLine({ authorId, name, department, at }: {
  authorId: string; name?: string | null; department?: string | null; at: string;
}) {
  const s = makeStyles();
  return (
    <View style={s.authorRow}>
      <Pressable onPress={() => router.push(`/members/${authorId}` as any)} accessibilityRole="link">
        <Text style={s.author}>{name || 'Member'}</Text>
      </Pressable>
      {department ? <Text style={s.meta} numberOfLines={1}>{department}</Text> : null}
      <Text style={s.meta}>{relativeTime(at)}</Text>
    </View>
  );
}

const mediaUri = (p: string) => publicObjectUrl('nffga-media', p);

export function PostCard({ post, compact, linked = true, actions }: {
  post: BoardPost;
  /** Home page: clamp the body, smaller photo. */
  compact?: boolean;
  /** Tapping the body opens the post. Off on the post's own page. */
  linked?: boolean;
  /** Extra controls on the footer row (delete). */
  actions?: React.ReactNode;
}) {
  const s = makeStyles();
  const announce = post.kind === 'announcement';
  const open = () => router.push(`/clubhouse/${post.id}` as any);
  // Several photos since migration 108; older rows only have photo_path.
  const photoList = post.photo_paths?.length ? post.photo_paths : (post.photo_path ? [post.photo_path] : []);
  const count = post.comment_count ?? 0;

  const body = post.body ? (
    <Text style={s.body} numberOfLines={compact ? 4 : undefined}>{post.body}</Text>
  ) : null;

  return (
    <View style={[s.card, announce ? s.announce : s.row]}>
      {announce ? <Eyebrow>Announcement</Eyebrow> : null}
      <AuthorLine
        authorId={post.author_id}
        name={post.author?.display_name}
        department={post.author?.department}
        at={post.created_at}
      />
      {linked ? (
        <Pressable onPress={open} accessibilityRole="link" accessibilityLabel="Open post" style={s.bodyWrap}>
          {body}
          <PostPhotos paths={photoList} toUri={mediaUri} compact={compact} />
        </Pressable>
      ) : (
        <View style={s.bodyWrap}>
          {body}
          <PostPhotos paths={photoList} toUri={mediaUri} />
        </View>
      )}
      <View style={s.footer}>
        {linked ? (
          <Pressable onPress={open} accessibilityRole="link">
            <Text style={s.meta}>{count === 1 ? '1 comment' : `${count} comments`}</Text>
          </Pressable>
        ) : (
          <Text style={s.meta}>{count === 1 ? '1 comment' : `${count} comments`}</Text>
        )}
        {actions}
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  card: { gap: Spacing.xs },
  row: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  announce: {
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.textSecondary, borderRadius: Radius.control,
    marginVertical: Spacing.xs,
  },
  authorRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs, flexWrap: 'wrap' },
  author: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  meta: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  bodyWrap: { gap: Spacing.sm },
  body: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, minHeight: 28 },
}); }
