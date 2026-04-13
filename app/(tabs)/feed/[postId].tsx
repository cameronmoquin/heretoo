import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Avatar } from '../../../components/shared/Avatar';
import { BridgeScoreBadge } from '../../../components/feed/BridgeScoreBadge';
import { LoadingPulse } from '../../../components/shared/LoadingPulse';
import { Colors } from '../../../constants/colors';
import { useToggleEngagement } from '../../../hooks/useFeed';
import { TouchableOpacity } from 'react-native';
import type { EngagementType } from '../../../stores/feedStore';

const ENGAGEMENT_BUTTONS: { type: EngagementType; label: string; color: string }[] = [
  { type: 'agree', label: 'Agree', color: Colors.agree },
  { type: 'important', label: 'Important', color: Colors.important },
  { type: 'disagree', label: 'Disagree', color: Colors.disagree },
  { type: 'bridge', label: 'Bridge', color: Colors.bridge },
];

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const toggleEngagement = useToggleEngagement();

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url, cluster_id)
        `)
        .eq('id', postId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !post) return <LoadingPulse />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Author */}
        <View style={styles.authorRow}>
          <Avatar
            url={post.author?.avatar_url}
            name={post.author?.display_name}
            size={48}
          />
          <View>
            <Text style={styles.authorName}>{post.author?.display_name}</Text>
            <Text style={styles.authorUsername}>@{post.author?.username}</Text>
          </View>
        </View>

        {/* Content */}
        {post.content && (
          <Text style={styles.content}>{post.content}</Text>
        )}

        {/* Media */}
        {post.media_type === 'photo' && post.photo_urls?.map((url: string, i: number) => (
          <Image
            key={i}
            source={{ uri: url }}
            style={styles.photo}
            resizeMode="cover"
          />
        ))}

        {/* Bridge Score */}
        <View style={styles.scoreSection}>
          <BridgeScoreBadge
            clusterReach={post.cluster_reach}
            bridgingScore={post.bridging_score}
          />
          <Text style={styles.engagementCount}>
            {post.total_engagements} engagements
          </Text>
        </View>

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
      </ScrollView>
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
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  authorUsername: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  content: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  photo: {
    width: '100%',
    height: 300,
    borderRadius: 12,
  },
  scoreSection: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  engagementCount: {
    fontSize: 13,
    color: Colors.textMuted,
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
    fontWeight: '600',
  },
});
