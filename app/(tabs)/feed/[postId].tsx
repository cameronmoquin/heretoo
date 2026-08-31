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
  useWindowDimensions,
} from 'react-native';
import { MOBILE_TAB_BAR_HEIGHT } from '../../../components/shared/MobileTabBar';
import { shouldShowLeftSidebar } from '../../../components/shared/LeftSidebar';
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
import { useRevealed, useOpenDrop, useBurnFuse, useAshed } from '../../../hooks/usePostViews';
import { showAlert, showConfirm } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { MicInputButton } from '../../../components/shared/MicInputButton';
import { Layout, Spacing, Radius, Type } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

const MAX_INDENT = 4; // visual cap — beyond 4 levels deep all replies share the same indent

export default function PostDetail() {
  const s = makeStyles();
  // `focus=comment` query param auto-scrolls and focuses the composer
  // input. PostCard's comment bubble passes this when tapped so the
  // user lands directly in the input rather than having to scroll +
  // tap themselves.
  const { postId, focus } = useLocalSearchParams<{ postId: string; focus?: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  // Reserve the mobile tab bar height so the comment composer isn't
  // hidden under the fixed bottom nav.
  const { width: vw } = useWindowDimensions();
  const tabBarOffset = shouldShowLeftSidebar(vw) ? 0 : MOBILE_TAB_BAR_HEIGHT;
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
  // Burn-drop hooks. These MUST sit above every early return with the
  // rest of the hooks — the same rule the useEffect comment below spells
  // out. They were added below the loading guard, which changed the hook
  // count between the loading render and the loaded render (React #310),
  // and crashed the detail page on every open. Keyed on postId (not
  // post.id) because post is not resolved yet up here.
  const revealed = useRevealed(postId ?? '');
  const openDrop = useOpenDrop();
  const fuseLeft = useBurnFuse(postId ?? '');
  const ashed = useAshed(postId ?? '');

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

  // ── Auto-focus the composer when arriving with ?focus=comment ──
  // CRITICAL: this useEffect MUST sit before any early return, or the
  // rules of hooks break (the call count changes between renders →
  // React error #310 → the entire detail page crashes → you can't
  // comment). Previous version had this AFTER the loading guard,
  // which is why the page died after the comment-bubble navigation.
  useEffect(() => {
    if (focus !== 'comment' || !inputRef.current) return;
    const t = setTimeout(() => {
      try { inputRef.current?.focus(); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [focus]);

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
        <Text style={s.empty}>{Vocab.Post} not found.</Text>
      </SafeAreaView>
    );
  }

  const media = post.media ?? [];
  const isOwner = post.author_id === userId;
  // A burning drop stays shut here too. PostCard only blocked navigation
  // from the card, so any other way in (pasted link, boost, comment deep
  // link) rendered the payload in full and recorded no view, which meant
  // the drop never burned. The author always sees their own. (revealed +
  // openDrop are hoisted above the early returns — see the top of the
  // component.)
  const sealed = !!(post as any).destruct_on_view && !isOwner && !revealed;
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
          // Both inline AND alert so the user can't miss it. Previous
          // version only showed an inline error which was easy to miss
          // when the page was scrolled. Logging the full object makes
          // debugging via DevTools straightforward.
          // eslint-disable-next-line no-console
          console.error('COMMENT_INSERT_ERROR', e, JSON.stringify(e ?? {}, null, 2));
          const msg = e?.message ?? e?.hint ?? 'Could not post. Try again.';
          setSubmitErr(msg);
          showAlert('Could not post comment', msg);
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

          {sealed ? (
            <TouchableOpacity
              style={s.sealCard}
              onPress={() => openDrop(post.id, post.body)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Open this ${Vocab.post}. It does not come back.`}
            >
              <Ionicons name="flame-outline" size={22} color={Colors.textSecondary} />
              <Text style={s.sealText}>Opens once</Text>
            </TouchableOpacity>
          ) : ashed ? (
            <View style={s.ashRow}>
              <View style={s.ashBar} accessibilityLabel="Redacted" />
              <Text style={s.ashMark}>burned after reading</Text>
            </View>
          ) : (
          <>
          {!!post.body && <Text style={s.body}>{post.body}</Text>}
          {!!(post as any).destruct_on_view && !isOwner && fuseLeft !== null && (
            <Text style={s.ashMark}>0:{String(fuseLeft).padStart(2, '0')}</Text>
          )}
          {!!post.slugline && (
            <Text style={s.slugline} numberOfLines={2}>{post.slugline}</Text>
          )}

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
                      backgroundColor: '#000', borderRadius: Radius.media,
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
          </>
          )}

          <View style={s.commentsHeader}>
            <Text style={s.commentsLabel}>
              Comments {totalCount ? `(${totalCount})` : ''}
            </Text>
          </View>

          {commentsDisabled && (
            <Text style={s.noComments}>Comments off.</Text>
          )}

          {!commentsDisabled && comments && comments.length === 0 && (
            <Text style={s.noComments}>No comments yet.</Text>
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
          <View style={[s.composer, { paddingBottom: 10 }]}>
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
                placeholder={replyTo ? 'Reply' : 'Comment'}
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
                  ? <ActivityIndicator size="small" color={Colors.onPrimary} />
                  : <Ionicons name="send" size={18} color={Colors.onPrimary} />}
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
                size={16}
                color={hearted ? Colors.heart : Colors.textSecondary}
              />
              {heartCount > 0 && (
                <Text style={[s.commentHeartCount, hearted && { color: Colors.heart }]}>
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
  root: {
    flex: 1, backgroundColor: 'transparent',
    maxWidth: Layout.columnMaxWidth, alignSelf: 'center', width: '100%',
  },
  scroll: {
    padding: Layout.columnPadding, gap: Spacing.sm,
    width: '100%', paddingBottom: 80,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  author: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  time: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  // The seal. A well where the payload would be, with the one control
  // that opens it. Same device as the row in the column.
  sealCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt,
    alignSelf: 'flex-start',
  },
  ashRow: { gap: 4, paddingVertical: 8 },
  ashBar: { height: 14, width: 140, maxWidth: '100%', backgroundColor: Colors.textPrimary, borderRadius: 2 },
  ashMark: { fontSize: Type.caption.size, color: Colors.textMuted },
  sealText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
  body: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary,
  },
  // Optional attribution line — small italic right-aligned, used by
  // Shakespeare bot posts and any post with a slugline.
  slugline: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontStyle: 'italic', color: Colors.textMuted,
    textAlign: 'right', marginTop: 2,
  },
  image: {
    width: '100%', aspectRatio: 4 / 3,
    borderRadius: Radius.media, backgroundColor: Colors.surfaceAlt,
  },
  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },

  muteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
  },
  muteBtnText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textPrimary, fontWeight: '600',
  },

  commentsHeader: {
    marginTop: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  commentsLabel: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontWeight: '600', color: Colors.textSecondary,
  },
  noComments: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 4,
  },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  commentAvatar: {
    width: 28, height: 28, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: {
    color: Colors.textPrimary, fontSize: Type.caption.size, fontWeight: '700',
  },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  commentAuthor: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  commentTime: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },
  commentBody: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textPrimary, marginTop: 2,
  },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  commentActionLink: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
  commentHeartBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentHeartCount: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textSecondary,
  },

  composer: {
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: Layout.columnPadding, paddingVertical: 10,
    gap: 6,
  },
  replyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceAlt, alignSelf: 'flex-start',
  },
  replyPillText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textPrimary,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.control, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: Type.body.size, color: Colors.textPrimary, maxHeight: 100,
  },
  composerSend: {
    width: 38, height: 38, borderRadius: Radius.control,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(255,64,80,0.10)',
    borderWidth: 1, borderColor: 'rgba(255,64,80,0.30)',
    borderRadius: Radius.control,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  errorText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.error,
  },

  composerTagBtn: {
    width: 38, height: 38, borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  tagBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  tagCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.media,
    width: '100%', maxWidth: 420, padding: 18, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tagTitle: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight, color: Colors.textPrimary, marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  tagAvatar: {
    width: 36, height: 36, borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tagAvatarImg: { width: '100%', height: '100%' },
  tagAvatarText: {
    color: Colors.onPrimary, fontSize: Type.ui.size, fontWeight: '700',
  },
  tagName: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
  tagHandle: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 1,
  },
  tagCancel: { alignItems: 'center', paddingVertical: 11, marginTop: 6 },
  tagCancelText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: Type.ui.weight, color: Colors.textSecondary,
  },
}); }
