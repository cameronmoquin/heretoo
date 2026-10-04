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
import { deletePost, relativeTime, useBoardRefresh } from '../../../lib/nffga/board';
import { useSession } from '../../../lib/nffga/useSession';
import { useRole } from '../../../lib/nffga/profile';
import { Button } from '../../shared/Button';
import { confirm } from '../../shared/ConfirmSheet';
import { toastError, toastSuccess } from '../../shared/Toast';
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

/**
 * Delete for the post's author, or an officer moderating. Soft delete:
 * the database sets deleted_at (migration 105), so the post disappears
 * everywhere at once. Renders nothing for anyone else.
 */
export function PostDeleteButton({ post }: { post: BoardPost }) {
  const { userId } = useSession();
  const role = useRole(userId);
  const refresh = useBoardRefresh();
  if (!userId || (post.author_id !== userId && !role.data)) return null;
  const remove = () => confirm({
    title: 'Delete this post?',
    message: 'It will be removed from the Clubhouse.',
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: async () => {
      const res = await deletePost(post.id);
      if (!res.ok) { toastError(res.error); return; }
      toastSuccess('Post deleted.');
      refresh();
    },
  });
  return <Button title="Delete" onPress={remove} variant="ghost" size="sm" />;
}

export function PostCard({ post, compact, linked = true, actions }: {
  post: BoardPost;
  /** Home page: clamp the body, smaller photo. */
  compact?: boolean;
  /** Tapping the body opens the post. Off on the post's own page. */
  linked?: boolean;
  /** Footer controls. Defaults to a Delete button for the author (or an
   *  officer), so every post in every list can be removed by its owner. */
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
        {actions === undefined ? <PostDeleteButton post={post} /> : actions}
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
