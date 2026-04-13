import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { Avatar } from '../shared/Avatar';
import { BridgeScoreBadge } from './BridgeScoreBadge';
import { FlagModal } from '../shared/FlagModal';
import type { Post, EngagementType } from '../../stores/feedStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onEngage: (postId: string, type: EngagementType) => void;
}

const ENGAGEMENT_BUTTONS: { type: EngagementType; label: string; color: string }[] = [
  { type: 'agree', label: 'Agree', color: Colors.agree },
  { type: 'important', label: 'Important', color: Colors.important },
  { type: 'disagree', label: 'Disagree', color: Colors.disagree },
  { type: 'bridge', label: 'Bridge', color: Colors.bridge },
];

export function PostCard({ post, onEngage }: PostCardProps) {
  const userEngagements = post.user_engagements ?? [];
  const [flagModalVisible, setFlagModalVisible] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(`/(tabs)/feed/${post.id}`)}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => router.push(`/(tabs)/profile/${post.author_id}`)}
        >
          <Avatar
            url={post.author?.avatar_url}
            name={post.author?.display_name}
            size={36}
          />
          <View>
            <Text style={styles.authorName}>
              {post.author?.display_name ?? 'Unknown'}
            </Text>
            <Text style={styles.authorUsername}>
              @{post.author?.username}
            </Text>
          </View>
        </TouchableOpacity>
        <BridgeScoreBadge
          clusterReach={post.cluster_reach}
          bridgingScore={post.bridging_score}
        />
      </View>

      {/* Content */}
      {post.content && (
        <Text style={styles.content}>{post.content}</Text>
      )}

      {/* Photo */}
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
                  style={styles.gridPhoto}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Video thumbnail */}
      {post.media_type === 'video' && post.mux_thumbnail_url && (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.mux_thumbnail_url }}
            style={styles.singlePhoto}
            resizeMode="cover"
          />
          <View style={styles.playOverlay}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
      )}

      {/* Engagement buttons */}
      <View style={styles.engagementRow}>
        {ENGAGEMENT_BUTTONS.map(({ type, label, color }) => {
          const isActive = userEngagements.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.engagementButton,
                isActive && { backgroundColor: `${color}12` },
              ]}
              onPress={() => onEngage(post.id, type)}
            >
              <Text
                style={[
                  styles.engagementLabel,
                  { color: isActive ? color : Colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.flagButton}
          onPress={() => setFlagModalVisible(true)}
        >
          <Text style={styles.flagLabel}>...</Text>
        </TouchableOpacity>
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
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textPrimary,
  },
  authorUsername: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textMuted,
  },
  content: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: 12,
  },
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  singlePhoto: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridPhoto: {
    width: (SCREEN_WIDTH - 68) / 2,
    height: 140,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playIcon: {
    fontSize: 36,
    color: '#FFFFFF',
  },
  engagementRow: {
    flexDirection: 'row',
    gap: 6,
  },
  engagementButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  engagementLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  flagButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagLabel: {
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
});
