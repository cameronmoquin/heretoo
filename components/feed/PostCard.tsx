import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { Avatar } from '../shared/Avatar';
import { FlagModal } from '../shared/FlagModal';
import { VideoPlayer } from './VideoPlayer';
import type { Post, EngagementType } from '../../stores/feedStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PostCardProps {
  post: Post;
  onEngage: (postId: string, type: EngagementType) => void;
}

const REACTIONS: { type: EngagementType; label: string; color: string }[] = [
  { type: 'agree', label: 'Agree', color: Colors.agree },
  { type: 'important', label: 'Important', color: Colors.important },
  { type: 'disagree', label: 'Disagree', color: Colors.disagree },
  { type: 'bridge', label: 'Bridge', color: Colors.bridge },
];

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function PostCard({ post, onEngage }: PostCardProps) {
  const active = post.user_engagements ?? [];
  const [flagOpen, setFlagOpen] = useState(false);

  return (
    <View style={styles.card}>
      {/* Author */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => router.push(`/(tabs)/profile/${post.author_id}`)}
        activeOpacity={0.7}
      >
        <Avatar url={post.author?.avatar_url} name={post.author?.display_name} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{post.author?.display_name ?? 'Someone'}</Text>
          <Text style={styles.meta}>@{post.author?.username} · {timeAgo(post.created_at)}</Text>
        </View>
        <TouchableOpacity onPress={() => setFlagOpen(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.more}>···</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Text */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/(tabs)/feed/${post.id}`)}>
        {post.content ? <Text style={styles.body}>{post.content}</Text> : null}

        {/* Single photo */}
        {post.media_type === 'photo' && post.photo_urls?.[0] && (
          <Image source={{ uri: post.photo_urls[0] }} style={styles.photo} resizeMode="cover" />
        )}

        {/* Video */}
        {post.media_type === 'video' && post.mux_playback_id && (
          <VideoPlayer playbackId={post.mux_playback_id} thumbnailUrl={post.mux_thumbnail_url ?? undefined} />
        )}
      </TouchableOpacity>

      {/* Bridge badge — subtle */}
      {post.cluster_reach > 2 && (
        <Text style={styles.bridgeHint}>
          Heard across {post.cluster_reach} communities
        </Text>
      )}

      {/* Reactions */}
      <View style={styles.reactionRow}>
        {REACTIONS.map(({ type, label, color }) => {
          const on = active.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[styles.reaction, on && { backgroundColor: `${color}0D` }]}
              onPress={() => onEngage(post.id, type)}
              activeOpacity={0.6}
            >
              <Text style={[styles.reactionText, on && { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlagModal visible={flagOpen} onClose={() => setFlagOpen(false)} contentType="post" contentId={post.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  meta: { fontSize: 13, fontWeight: '400', color: Colors.textMuted, marginTop: 1 },
  more: { fontSize: 18, color: Colors.textMuted, letterSpacing: 1 },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 10,
  },
  photo: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    marginBottom: 10,
  },
  bridgeHint: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    marginBottom: 8,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reaction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },
});
