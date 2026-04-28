import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { mediaPathToUrl, mediaPathToThumb } from '../../../hooks/useUpload';
import { useComments, useAddComment, useDeleteComment } from '../../../hooks/useComments';
import { useAuthStore } from '../../../stores/authStore';
import { showAlert, showConfirm } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function PostDetail() {
  const s = makeStyles();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [draft, setDraft] = useState('');
  const { data: comments } = useComments(postId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

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
  const submitComment = () => {
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(
      { postId, body },
      {
        onSuccess: () => setDraft(''),
        onError: (e: any) => showAlert('Could not post', e?.message ?? 'Try again.'),
      },
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(post.author?.display_name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.author}>
                {post.author?.display_name ?? post.author?.handle ?? 'Unknown'}
              </Text>
              <Text style={s.time}>{new Date(post.created_at).toLocaleString()}</Text>
            </View>
          </View>

          {!!post.body && <Text style={s.body}>{post.body}</Text>}

          {media.map((m: any) => (
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
                  <Image
                    key={m.id}
                    source={{ uri: mediaPathToThumb(m.storage_path) ?? mediaPathToUrl(m.storage_path) }}
                    style={s.image}
                    resizeMode="cover"
                  />
                )
            ) : (
              <Image
                key={m.id}
                source={{ uri: mediaPathToUrl(m.storage_path) }}
                style={s.image}
                resizeMode="cover"
              />
            )
          ))}

          <View style={s.commentsHeader}>
            <Text style={s.commentsLabel}>
              Comments {comments?.length ? `(${comments.length})` : ''}
            </Text>
          </View>

          {comments && comments.length === 0 && (
            <Text style={s.noComments}>No comments yet. Say something.</Text>
          )}

          {comments?.map((c) => {
            const isMine = c.author_id === userId;
            return (
              <View key={c.id} style={s.commentRow}>
                <View style={s.commentAvatar}>
                  <Text style={s.commentAvatarText}>
                    {(c.author?.display_name ?? '?').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.commentMeta}>
                    <Text style={s.commentAuthor}>
                      {c.author?.display_name ?? c.author?.handle ?? 'Unknown'}
                    </Text>
                    <Text style={s.commentTime}>{relTime(c.created_at)}</Text>
                  </View>
                  <Text style={s.commentBody}>{c.body}</Text>
                </View>
                {isMine && (
                  <TouchableOpacity
                    onPress={() => showConfirm(
                      'Delete comment?', '',
                      () => deleteComment.mutate(c.id), 'Delete', 'Cancel',
                    )}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Comment composer pinned to the bottom */}
        <View style={s.composer}>
          <TextInput
            style={s.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity
            style={[s.composerSend, !draft.trim() && { opacity: 0.4 }]}
            onPress={submitComment}
            disabled={!draft.trim() || addComment.isPending}
          >
            <Ionicons name="send" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
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
}); }
