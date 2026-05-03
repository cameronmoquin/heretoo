/**
 * Post detail page — renders the post + the recursive comment tree.
 *
 * Comments now nest infinitely. Each node has a Reply button that
 * targets the composer at the bottom (which gets a "Replying to …"
 * pill until the user submits or cancels). Owner-only: a "Disable
 * comments" toggle that flips `posts.comments_disabled`.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Image, Modal, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { mediaPathToUrl, mediaPathToThumb } from '../../../hooks/useUpload';
import { StatureAvatar } from '../../../components/shared/StatureAvatar';
import { Lightbox } from '../../../components/shared/Lightbox';
import {
  useCommentTree, useAddComment, useDeleteComment, useToggleCommentsDisabled,
  useToggleCommentHeart,
  type CommentNode,
} from '../../../hooks/useComments';
import { useMyConnections } from '../../../hooks/useFamily';
import { useAuthStore } from '../../../stores/authStore';
import { showAlert, showConfirm } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { MicInputButton } from '../../../components/shared/MicInputButton';
import { Spacing, Radius } from '../../../constants/design';

const MAX_INDENT = 4; // visual cap — beyond 4 levels deep all replies share the same indent

export default function PostDetail() {
  const s = makeStyles();
  // `focus=comment` query param auto-scrolls and focuses the composer
  // input. PostCard's comment bubble passes this when tapped so the
  // user lands directly in the input rather than having to scroll +
  // tap themselves.
  const { postId, focus } = useLocalSearchParams<{ postId: string; focus?: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const inputRef = useRef<TextInput | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const { data: connections } = useMyConnections();
  const { data: comments } = useCommentTree(postId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const toggleMute = useToggleCommentsDisabled();
  const toggleCommentHeart = useToggleCommentHeart(postId);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from('posts')
        .select(`*, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)`)
        .eq('id', postId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!postId,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!post || !postId) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Post not found.</Text>
      </SafeAreaView>
    );
  }

  const media = post.media ?? [];
  const isOwner = post.author_id === userId;

  // ── Auto-focus the composer when arriving with ?focus=comment ──
  // Triggered by PostCard's comment-bubble onPress so the user lands
  // directly in the input. Small delay so the view has time to mount
  // and the input ref binds before .focus() fires.
  useEffect(() => {
    if (focus !== 'comment' || !inputRef.current) return;
    const t = setTimeout(() => {
      try { inputRef.current?.focus(); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [focus]);
  const commentsDisabled = !!post.comments_disabled;
  const totalCount: number = post.comment_count ?? countTree(comments ?? []);

  const submitComment = () => {
    const body = draft.trim();
    if (!body) return;
    setSubmitErr(null);
    addComment.mutate(
      { postId, body, parentCommentId: replyTo?.id },
      {
        onSuccess: () => { setDraft(''); setReplyTo(null); },
        onError: (e: any) => {
          // Inline error so the user always sees what failed — popups
          // get blocked or missed on mobile web.
          // eslint-disable-next-line no-console
          console.error('COMMENT_INSERT_ERROR', e);
          const msg = e?.message ?? 'Could not post — try again.';
          setSubmitErr(msg);
        },
      },
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <StatureAvatar
              profileId={post.author_id}
              name={post.author?.display_name ?? post.author?.handle ?? null}
              photoUrl={post.author?.avatar_path ? mediaPathToUrl(post.author.avatar_path) : null}
              size={48}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.author}>
                {post.author?.display_name ?? post.author?.handle ?? 'Unknown'}
              </Text>
              <Text style={s.time}>{new Date(post.created_at).toLocaleString()}</Text>
            </View>
            {isOwner && (
              <TouchableOpacity
                onPress={() => toggleMute.mutate({ postId, disabled: !commentsDisabled })}
                style={s.muteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={commentsDisabled ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                  size={14}
                  color={commentsDisabled ? Colors.textMuted : Colors.textPrimary}
                />
                <Text style={s.muteBtnText}>
                  {commentsDisabled ? 'Comments off' : 'Comments on'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!!post.body && <Text style={s.body}>{post.body}</Text>}

          {media.map((m: any, i: number) => (
            m.media_type === 'video' ? (
              Platform.OS === 'web'
                ? React.createElement('video', {
                    key: m.id,
                    src: mediaPathToUrl(m.storage_path),
                    poster: mediaPathToThumb(m.storage_path) ?? undefined,
                    autoPlay: true,
                    loop: true,
                    muted: true,
                    playsInline: true,
                    controls: true,
                    style: {
                      width: '100%', aspectRatio: 9 / 16,
                      backgroundColor: '#000', borderRadius: 12,
                      objectFit: 'cover',
                    },
                  })
                : (
                  <TouchableOpacity key={m.id} onPress={() => setLightboxIdx(i)} activeOpacity={0.85}>
                    <Image
                      source={{ uri: mediaPathToThumb(m.storage_path) ?? mediaPathToUrl(m.storage_path) }}
                      style={s.image}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )
            ) : (
              <TouchableOpacity key={m.id} onPress={() => setLightboxIdx(i)} activeOpacity={0.85}>
                <Image
                  source={{ uri: mediaPathToUrl(m.storage_path) }}
                  style={s.image}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )
          ))}

          <View style={s.commentsHeader}>
            <Text style={s.commentsLabel}>
              Comments {totalCount ? `(${totalCount})` : ''}
            </Text>
          </View>

          {commentsDisabled && (
            <Text style={s.noComments}>The author has turned off comments.</Text>
          )}

          {!commentsDisabled && comments && comments.length === 0 && (
            <Text style={s.noComments}>No comments yet. Say something.</Text>
          )}

          {(comments ?? []).map((c) => (
            <CommentRow
              key={c.id}
              node={c}
              depth={0}
              userId={userId ?? null}
              onReply={(node) =>
                setReplyTo({
                  id: node.id,
                  name: node.author?.display_name ?? node.author?.handle ?? 'them',
                })
              }
              onDelete={(id) =>
                showConfirm(
                  'Delete comment?', '',
                  () => deleteComment.mutate(id), 'Delete', 'Cancel',
                )
              }
              onHeart={(id) => toggleCommentHeart.mutate(id)}
            />
          ))}
        </ScrollView>

        {/* Comment composer pinned to the bottom */}
        {!commentsDisabled && (
          <View style={s.composer}>
            {replyTo && (
              <View style={s.replyPill}>
                <Text style={s.replyPillText} numberOfLines={1}>
                  Replying to <Text style={{ fontWeight: '700' }}>{replyTo.name}</Text>
                </Text>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {submitErr && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{submitErr}</Text>
              </View>
            )}
            <View style={s.composerRow}>
              <TouchableOpacity
                style={s.composerTagBtn}
                onPress={() => setTagPickerOpen(true)}
                accessibilityLabel="Tag a connection"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="at-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={s.composerInput}
                value={draft}
                onChangeText={(t) => { setDraft(t); if (submitErr) setSubmitErr(null); }}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Write a comment…'}
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                blurOnSubmit={false}
                onKeyPress={(e: any) => {
                  // Web/keyboard: Cmd+Enter or Ctrl+Enter submits a comment;
                  // plain Enter inserts a newline (multiline default).
                  const ne: any = e?.nativeEvent ?? {};
                  if (ne.key === 'Enter' && (ne.metaKey || ne.ctrlKey)) {
                    e.preventDefault?.();
                    submitComment();
                  }
                }}
              />
              <MicInputButton
                size={18}
                onText={(t) => setDraft((d) => (d ? `${d} ${t}`.trim() : t))}
              />
              <TouchableOpacity
                style={[s.composerSend, (!draft.trim() || addComment.isPending) && { opacity: 0.4 }]}
                onPress={submitComment}
                disabled={!draft.trim() || addComment.isPending}
              >
                {addComment.isPending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Tag picker — connections list, inserts @handle into the draft. */}
      <Modal
        visible={tagPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTagPickerOpen(false)}
      >
        <Pressable style={s.tagBackdrop} onPress={() => setTagPickerOpen(false)}>
          <Pressable style={s.tagCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.tagTitle}>Tag a connection</Text>
            <Text style={s.tagSub}>
              {(connections?.length ?? 0) > 0
                ? `${connections!.length} ${connections!.length === 1 ? 'person' : 'people'} in your network`
                : "You're not connected to anyone yet."}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(connections ?? []).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={s.tagRow}
                  onPress={() => {
                    if (c.handle) {
                      setDraft((b) => (b.length > 0 ? `${b} @${c.handle}` : `@${c.handle}`));
                    }
                    setTagPickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.tagAvatar}>
                    {c.avatar_path ? (
                      <Image source={{ uri: mediaPathToUrl(c.avatar_path) }} style={s.tagAvatarImg} />
                    ) : (
                      <Text style={s.tagAvatarText}>
                        {(c.display_name ?? c.handle ?? '?').slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tagName}>{c.display_name ?? c.handle ?? 'Unknown'}</Text>
                    {c.handle && <Text style={s.tagHandle}>@{c.handle}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.tagCancel} onPress={() => setTagPickerOpen(false)}>
              <Text style={s.tagCancelText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Lightbox
        media={media}
        startIndex={lightboxIdx ?? 0}
        visible={lightboxIdx !== null}
        onClose={() => setLightboxIdx(null)}
      />
    </SafeAreaView>
  );
}

function CommentRow({
  node, depth, userId, onReply, onDelete, onHeart,
}: {
  node: CommentNode;
  depth: number;
  userId: string | null;
  onReply: (n: CommentNode) => void;
  onDelete: (id: string) => void;
  onHeart: (id: string) => void;
}) {
  const s = makeStyles();
  const isMine = node.author_id === userId;
  const indent = Math.min(depth, MAX_INDENT) * 16;
  const hearted = !!node.viewer_hearted;
  const heartCount = node.heart_count ?? 0;

  return (
    <View>
      <View style={[s.commentRow, { marginLeft: indent }]}>
        <View style={s.commentAvatar}>
          <Text style={s.commentAvatarText}>
            {(node.author?.display_name ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.commentMeta}>
            <Text style={s.commentAuthor}>
              {node.author?.display_name ?? node.author?.handle ?? 'Unknown'}
            </Text>
            <Text style={s.commentTime}>{relTime(node.created_at)}</Text>
          </View>
          <Text style={s.commentBody}>{node.body}</Text>
          <View style={s.commentActions}>
            <TouchableOpacity
              onPress={() => onHeart(node.id)}
              style={s.commentHeartBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={hearted ? 'Unheart comment' : 'Heart comment'}
            >
              <Ionicons
                name={hearted ? 'heart' : 'heart-outline'}
                size={14}
                color={hearted ? Colors.primary : Colors.textMuted}
              />
              {heartCount > 0 && (
                <Text style={[s.commentHeartCount, hearted && { color: Colors.primary }]}>
                  {heartCount}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onReply(node)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={s.commentActionLink}>Reply</Text>
            </TouchableOpacity>
            {isMine && (
              <TouchableOpacity onPress={() => onDelete(node.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[s.commentActionLink, { color: Colors.textMuted }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      {node.children.map((child) => (
        <CommentRow
          key={child.id}
          node={child}
          depth={depth + 1}
          userId={userId}
          onReply={onReply}
          onDelete={onDelete}
          onHeart={onHeart}
        />
      ))}
    </View>
  );
}

function countTree(nodes: CommentNode[]): number {
  let n = 0;
  for (const c of nodes) n += 1 + countTree(c.children);
  return n;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: 12, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  author: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  time: { fontSize: 12, color: Colors.textMuted },
  body: { fontSize: 16, color: Colors.textPrimary, lineHeight: 22 },
  image: {
    width: '100%', aspectRatio: 4 / 3,
    borderRadius: Radius.md, backgroundColor: Colors.surfaceLight,
  },
  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },

  muteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
  },
  muteBtnText: { fontSize: 11, color: Colors.textPrimary, fontWeight: '600' },

  commentsHeader: { marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  commentsLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.4 },
  noComments: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  commentTime: { fontSize: 11, color: Colors.textMuted },
  commentBody: { fontSize: 14, color: Colors.textPrimary, marginTop: 2, lineHeight: 19 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  commentActionLink: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  commentHeartBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentHeartCount: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  composer: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    gap: 6,
  },
  replyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: Colors.primaryFaint, alignSelf: 'flex-start',
  },
  replyPillText: { fontSize: 12, color: Colors.textPrimary },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1, backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, maxHeight: 100,
  },
  composerSend: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(255,64,80,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,64,80,0.30)',
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  errorText: { fontSize: 12, color: Colors.error },

  composerTagBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },

  tagBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  tagCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 420, padding: 18, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tagTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  tagSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  tagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  tagAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tagAvatarImg: { width: '100%', height: '100%' },
  tagAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  tagName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  tagHandle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  tagCancel: { alignItems: 'center', paddingVertical: 11, marginTop: 6 },
  tagCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
