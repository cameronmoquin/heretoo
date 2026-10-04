/**
^ * /clubhouse/[id] — one post with its comments. Reading is public;
 * commenting needs an account. The author or an officer can delete.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Page, Muted, Loading } from '../../components/nffga/board/Page';
import { PostCard, AuthorLine } from '../../components/nffga/board/PostCard';
import { CommentBox } from '../../components/nffga/board/CommentBox';
import { RequireAccount } from '../../components/nffga/RequireAccount';
import { Button } from '../../components/shared/Button';
import { confirm } from '../../components/shared/ConfirmSheet';
import { toastError, toastSuccess } from '../../components/shared/Toast';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import { useRole } from '../../lib/nffga/profile';
import {
  deleteComment, deletePost, useBoardRefresh, useComments, usePost,
} from '../../lib/nffga/board';

export default function PostScreen() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Array.isArray(id) ? id[0] : id;
  const { userId } = useSession();
  const role = useRole(userId);
  const post = usePost(postId);
  const comments = useComments(postId);
  const refresh = useBoardRefresh();
  const isOfficer = !!role.data;

  const canDelete = (authorId: string) => !!userId && (authorId === userId || isOfficer);

  const removePost = () => {
    if (!postId) return;
    confirm({
      title: 'Delete this post?',
      message: 'It will be removed from the board.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const res = await deletePost(postId);
        if (!res.ok) { toastError(res.error); return; }
        toastSuccess('Post deleted.');
        refresh();
        router.replace('/clubhouse' as any);
      },
    });
  };

  const removeComment = (commentId: string) => {
    confirm({
      title: 'Delete this comment?',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const res = await deleteComment(commentId);
        if (!res.ok) { toastError(res.error); return; }
        refresh();
      },
    });
  };

  if (post.isLoading) return <Page title="Post"><Loading /></Page>;

  if (!post.data) {
    return (
      <Page title="Post">
        <Muted>This post is not available. It may have been deleted.</Muted>
        <View style={s.back}>
          <Button title="Back to the Clubhouse" onPress={() => router.replace('/clubhouse' as any)} variant="outline" size="md" />
        </View>
      </Page>
    );
  }

  const p = post.data;
  const list = comments.data ?? [];

  return (
    <Page title="Post">
      <View style={s.back}>
        <Button title="Clubhouse" onPress={() => router.push('/clubhouse' as any)} variant="ghost" size="sm" />
      </View>
      <PostCard
        post={{ ...p, comment_count: comments.data ? list.length : p.comment_count }}
        linked={false}
        actions={canDelete(p.author_id)
          ? <Button title="Delete" onPress={removePost} variant="ghost" size="sm" />
          : null}
      />

      <Text style={s.heading}>Comments</Text>
      {comments.isLoading ? <Loading /> : null}
      {!comments.isLoading && list.length === 0 ? <Muted>No comments yet.</Muted> : null}
      {list.map((c) => (
        <View key={c.id} style={s.comment}>
          <AuthorLine authorId={c.author_id} name={c.author?.display_name} department={c.author?.department} at={c.created_at} />
          <Text style={s.body}>{c.body}</Text>
          {canDelete(c.author_id) ? (
            <View style={s.commentActions}>
              <Button title="Delete" onPress={() => removeComment(c.id)} variant="ghost" size="sm" />
            </View>
          ) : null}
        </View>
      ))}

      <RequireAccount reason="to comment">
        <CommentBox postId={p.id} />
      </RequireAccount>
    </Page>
  );
}

function makeStyles() { return StyleSheet.create({
  back: { flexDirection: 'row' },
  heading: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight, color: Colors.textPrimary, marginTop: Spacing.sm,
  },
  comment: { gap: Spacing.xxs, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  body: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  commentActions: { flexDirection: 'row', justifyContent: 'flex-end' },
}); }
