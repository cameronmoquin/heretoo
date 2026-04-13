import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Shadow, Radius, Spacing } from '../../constants/design';
import { Avatar } from '../shared/Avatar';
import { BridgeScoreBadge } from './BridgeScoreBadge';
import { FlagModal } from '../shared/FlagModal';
import { VideoPlayer } from './VideoPlayer';
import type { Post, EngagementType } from '../../stores/feedStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onEngage: (postId: string, type: EngagementType) => void;
}

const ENGAGEMENT_BUTTONS: { type: EngagementType; label: string; activeColor: string }[] = [
  { type: 'agree', label: 'Agree', activeColor: Colors.agree },
  { type: 'important', label: 'Important', activeColor: Colors.important },
  { type: 'disagree', label: 'Disagree', activeColor: Colors.disagree },
  { type: 'bridge', label: 'Bridge', activeColor: Colors.bridge },
];

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function PostCard({ post, onEngage }: PostCardProps) {
  const userEngagements = post.user_engagements ?? [];
  const [flagModalVisible, setFlagModalVisible] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
      style={styles.container}
    >
      {/* Author row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={() => router.push(`/(tabs)/profile/${post.author_id}`)}
        >
          <Avatar
            url={post.author?.avatar_url}
            name={post.author?.display_name}
            size={40}
          />
          <View style={styles.authorText}>
            <Text style={styles.authorName}>
              {post.author?.display_name ?? 'Someone'}
            </Text>
            <Text style={styles.postMeta}>
              @{post.author?.username} · {getTimeAgo(post.created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFlagModalVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.moreButton}
        >
          <Text style={styles.moreIcon}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {post.content && (
        <Text style={styles.content}>{post.content}</Text>
      )}

      {/* Photos */}
      {post.media_type === 'photo' && post.photo_urls && post.photo_urls.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.photo_urls.length === 1 ? (
            <Image
              source={{ uri: post.photo_urls[0] }}
              style={styles.singlePhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoGrid}>
              {post.photo_urls.slice(0, 4).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={[styles.gridPhoto, { width: (SCREEN_WIDTH - 72) / 2 }]}
                  resizeMode="cover"
                />
              ))}
            </View>
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

      {/* Bridge score — only show if reaching multiple communities */}
      {post.cluster_reach > 1 && (
        <View style={styles.bridgeRow}>
          <BridgeScoreBadge
            clusterReach={post.cluster_reach}
            bridgingScore={post.bridging_score}
          />
        </View>
      )}

      {/* Engagement row */}
      <View style={styles.engagementRow}>
        {ENGAGEMENT_BUTTONS.map(({ type, label, activeColor }) => {
          const isActive = userEngagements.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.engageBtn,
                isActive && {
                  backgroundColor: `${activeColor}10`,
                  borderColor: `${activeColor}30`,
                },
              ]}
              onPress={() => onEngage(post.id, type)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.engageLabel,
                  { color: isActive ? activeColor : Colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlagModal
        visible={flagModalVisible}
        onClose={() => setFlagModalVisible(false)}
        contentType="post"
        contentId={post.id}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm + 2,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm + 4,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    flex: 1,
  },
  authorText: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
  },
  postMeta: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    marginTop: 1,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  moreIcon: {
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  content: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: Spacing.sm + 4,
  },
  mediaContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm + 4,
  },
  singlePhoto: {
    width: '100%',
    height: 280,
    borderRadius: Radius.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  gridPhoto: {
    height: 160,
  },
  bridgeRow: {
    marginBottom: Spacing.sm,
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 6,
  },
  engageBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  engageLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.2,
  },
});
