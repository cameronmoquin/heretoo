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
import { useDeletePost } from '../../hooks/useFeed';
import { useBoostPost, type BoostScope } from '../../hooks/useBoosts';
import { useMyFamilies } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

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
        <View style={s.avatar}>
          {author?.avatar_path ? (
            <Image source={{ uri: mediaPathToUrl(author.avatar_path) }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarText}>
              {(author?.display_name ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.author}>{author?.display_name ?? author?.handle ?? 'Unknown'}</Text>
          <Text style={s.time}>{timeAgo(post.created_at)}</Text>
        </View>
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
  card: {
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    padding: Spacing.md,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  author: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 21 },
  mediaWrap: { position: 'relative', marginTop: 4, borderRadius: Radius.md, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: Colors.background },
  videoBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%', opacity: 0.7 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mediaCountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 24, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  actionCount: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14, padding: 18, gap: 4,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: Colors.border,
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
