/**
 * Single feed post card. Clean rewrite for the new schema (migrations 001 + 002).
 *
 * Reads body + media (image grid or Mux video) + denormalized engagement
 * counts off the `posts` row. Heart toggle is wired through onHeart prop.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Post } from '../../stores/feedStore';
import { Platform } from 'react-native';
import { mediaPathToUrl, mediaPathToThumb } from '../../hooks/useUpload';
import { StatureAvatar } from '../shared/StatureAvatar';
import { useDeletePost } from '../../hooks/useFeed';
import { useLatestComments } from '../../hooks/useComments';
import { useBoostPost, type BoostScope } from '../../hooks/useBoosts';
import { useMyFamilies } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type, Shadow } from '../../constants/design';

interface PostCardProps {
  post: Post;
  onHeart?: (postId: string) => void;
}

export function PostCard({ post, onHeart }: PostCardProps) {
  const s = makeStyles();
  const author = post.author;
  const media = post.media ?? [];
  const heartCount = post.heart_count ?? 0;
  const userId = useAuthStore((st) => st.user?.id);
  const isMine = userId === post.author_id;
  const deletePost = useDeletePost();
  const [boostOpen, setBoostOpen] = useState(false);
  const boost = useBoostPost();
  const { data: families } = useMyFamilies();

  const onDelete = () => {
    showConfirm(
      'Delete post?',
      'This cannot be undone.',
      () => deletePost.mutate(post.id),
      'Delete',
      'Cancel',
    );
  };

  return (
    <Pressable
      style={s.card}
      onPress={() => router.push(`/(tabs)/feed/${post.id}` as any)}
    >
      <View style={s.header}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            if (author?.handle) router.push(`/u/${author.handle}` as any);
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <StatureAvatar
            profileId={post.author_id}
            name={author?.display_name ?? author?.handle ?? null}
            photoUrl={author?.avatar_path ? mediaPathToUrl(author.avatar_path) : null}
            size={40}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.author}>{author?.display_name ?? author?.handle ?? 'Unknown'}</Text>
            <Text style={s.time}>{timeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        {isMine && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onDelete(); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Delete post"
          >
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!!post.body && <Text style={s.body}>{post.body}</Text>}

      {media.length > 0 && (
        <View style={s.mediaWrap}>
          {media[0].media_type === 'video' ? (
            Platform.OS === 'web' ? (
              React.createElement('video', {
                src: mediaPathToUrl(media[0].storage_path),
                poster: mediaPathToThumb(media[0].storage_path) ?? undefined,
                autoPlay: true,
                loop: true,
                muted: true,
                playsInline: true,
                style: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000', borderRadius: 8, objectFit: 'cover' },
              })
            ) : (
              <View style={s.videoBox}>
                <Image
                  source={{ uri: mediaPathToThumb(media[0].storage_path) ?? mediaPathToUrl(media[0].storage_path) }}
                  style={s.videoThumb}
                />
                <View style={s.playOverlay}>
                  <Ionicons name="play" size={32} color="#FFF" />
                </View>
              </View>
            )
          ) : (
            <Image
              source={{ uri: mediaPathToUrl(media[0].storage_path) }}
              style={s.image}
              resizeMode="cover"
            />
          )}
          {media.length > 1 && (
            <View style={s.mediaCount}>
              <Ionicons name="copy" size={11} color="#FFF" />
              <Text style={s.mediaCountText}>{media.length}</Text>
            </View>
          )}
        </View>
      )}

      <View style={s.actions}>
        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => onHeart?.(post.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={post.viewer_hearted ? 'heart' : 'heart-outline'}
            size={18}
            color={post.viewer_hearted ? Colors.primary : Colors.textSecondary}
          />
          {heartCount > 0 && <Text style={s.actionCount}>{heartCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={17} color={Colors.textSecondary} />
          {(post.comment_count ?? 0) > 0 && (
            <Text style={s.actionCount}>{post.comment_count}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          activeOpacity={0.7}
          onPress={(e) => { e.stopPropagation(); setBoostOpen(true); }}
        >
          <Ionicons name="repeat-outline" size={18} color={Colors.textSecondary} />
          {(post.boost_count ?? 0) > 0 && (
            <Text style={s.actionCount}>{post.boost_count}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Inline comment preview — latest 2 top-level comments. */}
      <CommentPreview postId={post.id} commentCount={post.comment_count ?? 0} />

      <Modal
        visible={boostOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBoostOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setBoostOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Boost this post</Text>
            <Text style={s.modalSub}>Where should it appear?</Text>

            <TouchableOpacity
              style={s.scopeRow}
              onPress={() => {
                setBoostOpen(false);
                boost.mutate(
                  { originalPostId: post.id, scope: 'public' },
                  { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                );
              }}
            >
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeLabel}>Public</Text>
                <Text style={s.scopeHint}>Anyone signed in</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.scopeRow}
              onPress={() => {
                setBoostOpen(false);
                boost.mutate(
                  { originalPostId: post.id, scope: 'connections' },
                  { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                );
              }}
            >
              <Ionicons name="git-network-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeLabel}>Your network</Text>
                <Text style={s.scopeHint}>Anyone in your family graph</Text>
              </View>
            </TouchableOpacity>

            {(families ?? []).map((f: any) => (
              <TouchableOpacity
                key={f.id}
                style={s.scopeRow}
                onPress={() => {
                  setBoostOpen(false);
                  boost.mutate(
                    { originalPostId: post.id, scope: 'family', familyId: f.id },
                    { onError: (e: any) => showAlert('Could not boost', e?.message ?? 'Try again.') },
                  );
                }}
              >
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.scopeLabel}>{f.name}</Text>
                  <Text style={s.scopeHint}>Only members of this family</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={s.modalCancel} onPress={() => setBoostOpen(false)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

/**
 * Inline comment preview shown directly under the actions row.
 * Pulls the latest 2 top-level comments. If there are more than what
 * we show, surfaces a "View all N comments" link that drops into the
 * post detail page.
 */
function CommentPreview({ postId, commentCount }: { postId: string; commentCount: number }) {
  const s = makeStyles();
  const { data: comments } = useLatestComments(postId, 2);
  if (!comments || comments.length === 0) return null;

  const moreToSee = commentCount > comments.length;

  return (
    <View style={s.commentPreview}>
      {comments.map((c) => (
        <View key={c.id} style={s.commentLine}>
          <Text style={s.commentName} numberOfLines={1}>
            {c.author?.display_name ?? c.author?.handle ?? 'someone'}
          </Text>
          <Text style={s.commentBody} numberOfLines={2}>{c.body}</Text>
        </View>
      ))}
      {moreToSee && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); router.push(`/(tabs)/feed/${postId}` as any); }}
        >
          <Text style={s.commentMore}>
            View all {commentCount} comment{commentCount === 1 ? '' : 's'} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return d.toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  // Cleaner card: thin top border, no bottom hairline (next card supplies
  // its own), tighter vertical rhythm.
  card: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,     // was Spacing.sm — more breathing room
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  avatar: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: Type.body.size, fontWeight: '700' },
  author: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: Type.uiBold.weight, color: Colors.textPrimary,
  },
  time: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 1,
  },
  body: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  mediaWrap: {
    position: 'relative', marginTop: Spacing.xs,
    borderRadius: Radius.md, overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    ...(Shadow.sm as object),
  },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Colors.background },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.7 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mediaCountText: {
    color: '#FFF', fontSize: Type.caption.size,
    fontWeight: '700', letterSpacing: 0.2,
  },
  actions: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xxs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.xxs,
  },
  actionCount: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary, fontWeight: '600',
  },

  commentPreview: {
    marginTop: Spacing.xxs, paddingTop: Spacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    gap: 4,
  },
  commentLine: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  commentName: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, flexShrink: 0 },
  commentBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, flex: 1 },
  commentMore: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.lg, gap: 4,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.border,
    ...(Shadow.lg as object),
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  modalSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  scopeLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  scopeHint: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  modalCancel: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  modalCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
