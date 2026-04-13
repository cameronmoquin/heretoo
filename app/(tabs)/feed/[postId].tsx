import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { DEV_MODE } from '../../../lib/dev-mode';
import { MOCK_POSTS } from '../../../lib/mock-data';
import { Avatar } from '../../../components/shared/Avatar';
import { BridgeScoreBadge } from '../../../components/feed/BridgeScoreBadge';
import { VideoPlayer } from '../../../components/feed/VideoPlayer';
import { Button } from '../../../components/shared/Button';
import { LoadingPulse } from '../../../components/shared/LoadingPulse';
import { useComments, useAddComment, type Comment } from '../../../hooks/useComments';
import { useToggleEngagement } from '../../../hooks/useFeed';
import { Colors } from '../../../constants/colors';
import { Fonts } from '../../../constants/typography';
import type { EngagementType } from '../../../stores/feedStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ENGAGEMENT_BUTTONS: { type: EngagementType; label: string; color: string }[] = [
  { type: 'agree', label: 'Agree', color: Colors.agree },
  { type: 'important', label: 'Important', color: Colors.important },
  { type: 'disagree', label: 'Disagree', color: Colors.disagree },
  { type: 'bridge', label: 'Bridge', color: Colors.bridge },
];

function CommentItem({ comment, onReply }: { comment: Comment; onReply: (id: string) => void }) {
  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Avatar url={comment.author?.avatar_url} name={comment.author?.display_name} size={28} />
        <Text style={styles.commentAuthor}>{comment.author?.display_name ?? 'Someone'}</Text>
        <Text style={styles.commentTime}>
          {getTimeAgo(comment.created_at)}
        </Text>
      </View>
      <Text style={styles.commentText}>{comment.content}</Text>
      <TouchableOpacity onPress={() => onReply(comment.id)}>
        <Text style={styles.replyButton}>Reply</Text>
      </TouchableOpacity>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.replies}>
          {comment.replies.map((reply) => (
            <View key={reply.id} style={styles.replyItem}>
              <View style={styles.commentHeader}>
                <Avatar url={reply.author?.avatar_url} name={reply.author?.display_name} size={22} />
                <Text style={styles.commentAuthor}>{reply.author?.display_name}</Text>
                <Text style={styles.commentTime}>{getTimeAgo(reply.created_at)}</Text>
              </View>
              <Text style={styles.commentText}>{reply.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const toggleEngagement = useToggleEngagement();
  const { data: comments, isLoading: commentsLoading } = useComments(postId);
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      if (DEV_MODE) {
        return MOCK_POSTS.find((p) => p.id === postId) ?? null;
      }
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url, cluster_id)
        `)
        .eq('id', postId)
        .single();
      if (error) throw error;
      if (!data) return MOCK_POSTS.find((p) => p.id === postId) ?? null;
      return data;
    },
  });

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(
      { postId, content: commentText.trim(), parentId: replyingTo ?? undefined },
      {
        onSuccess: () => {
          setCommentText('');
          setReplyingTo(null);
        },
      }
    );
  };

  if (isLoading || !post) return <LoadingPulse />;

  const photos = post.photo_urls ?? [];
  const hasMultiplePhotos = photos.length > 1;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Author */}
          <View style={styles.authorRow}>
            <Avatar
              url={post.author?.avatar_url}
              name={post.author?.display_name}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{post.author?.display_name}</Text>
              <Text style={styles.authorUsername}>@{post.author?.username}</Text>
            </View>
            <BridgeScoreBadge
              clusterReach={post.cluster_reach}
              bridgingScore={post.bridging_score}
            />
          </View>

          {/* Content */}
          {post.content && (
            <Text style={styles.content}>{post.content}</Text>
          )}

          {/* Photo Gallery */}
          {post.media_type === 'photo' && photos.length > 0 && (
            <View style={styles.galleryContainer}>
              {hasMultiplePhotos ? (
                <>
                  <FlatList
                    data={photos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(
                        e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40)
                      );
                      setActivePhotoIndex(index);
                    }}
                    renderItem={({ item }: { item: string }) => (
                      <Image
                        source={{ uri: item }}
                        style={[styles.galleryPhoto, { width: SCREEN_WIDTH - 40 }]}
                        resizeMode="cover"
                      />
                    )}
                    keyExtractor={(_: string, i: number) => String(i)}
                  />
                  {/* Dots */}
                  <View style={styles.dots}>
                    {photos.map((_: string, i: number) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === activePhotoIndex && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <Image
                  source={{ uri: photos[0] }}
                  style={styles.singlePhoto}
                  resizeMode="cover"
                />
              )}
            </View>
          )}

          {/* Video */}
          {post.media_type === 'video' && post.mux_playback_id && (
            <VideoPlayer
              playbackId={post.mux_playback_id}
              thumbnailUrl={post.mux_thumbnail_url ?? undefined}
            />
          )}

          {/* Tags */}
          {post.topic_tags && post.topic_tags.length > 0 && (
            <View style={styles.tagRow}>
              {post.topic_tags.map((tag: string, i: number) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Engagement buttons */}
          <View style={styles.engagementRow}>
            {ENGAGEMENT_BUTTONS.map(({ type, label, color }) => (
              <TouchableOpacity
                key={type}
                style={styles.engagementButton}
                onPress={() => toggleEngagement.mutate({ postId: post.id, type })}
              >
                <Text style={[styles.engagementLabel, { color }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Text style={styles.statText}>
              {post.total_engagements} engagements
            </Text>
            <Text style={styles.statText}>
              {(comments?.length ?? 0) + (comments?.reduce((sum, c) => sum + (c.replies?.length ?? 0), 0) ?? 0)} comments
            </Text>
          </View>

          {/* Comments */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>Comments</Text>
            {comments?.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(id) => setReplyingTo(id)}
              />
            ))}
            {(!comments || comments.length === 0) && (
              <Text style={styles.emptyComments}>No comments yet. Start the conversation.</Text>
            )}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View style={styles.commentInputArea}>
          {replyingTo && (
            <View style={styles.replyingBanner}>
              <Text style={styles.replyingText}>Replying to comment</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Text style={styles.cancelReply}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
              placeholderTextColor={Colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <Button
              title="Post"
              onPress={handleSendComment}
              loading={addComment.isPending}
              disabled={!commentText.trim()}
              size="sm"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorName: {
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
  },
  authorUsername: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  content: {
    fontSize: 18,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  galleryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  galleryPhoto: {
    height: 360,
    borderRadius: 12,
  },
  singlePhoto: {
    width: '100%',
    height: 360,
    borderRadius: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 8,
  },
  engagementButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
  },
  engagementLabel: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 4,
  },
  statText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  commentsSection: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
  },
  commentItem: {
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderLight,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
  },
  commentTime: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  commentText: {
    fontSize: 15,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    lineHeight: 22,
    paddingLeft: 36,
  },
  replyButton: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
    paddingLeft: 36,
    paddingTop: 2,
  },
  replies: {
    paddingLeft: 16,
    gap: 8,
    marginTop: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: Colors.border,
    marginLeft: 36,
  },
  replyItem: {
    gap: 4,
  },
  emptyComments: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentInputArea: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  replyingBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  replyingText: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  cancelReply: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    maxHeight: 80,
  },
});
