import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function PostDetail() {
  const s = makeStyles();
  const { postId } = useLocalSearchParams<{ postId: string }>();

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

  if (!post) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Post not found.</Text>
      </SafeAreaView>
    );
  }

  const media = post.media ?? [];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
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
          <Image
            key={m.id}
            source={{ uri: mediaPathToUrl(m.storage_path) }}
            style={s.image}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: 12, maxWidth: 600, alignSelf: 'center', width: '100%' },
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
}); }
