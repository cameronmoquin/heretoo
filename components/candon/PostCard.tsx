import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CandonColors } from '../../constants/candon-theme';
import type { FamilyPost } from '../../hooks/useFamilyPosts';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

const TYPE_META: Record<FamilyPost['post_type'], { icon: any; label: string; color: string }> = {
  general_update: { icon: 'chatbubble-outline', label: 'Update', color: CandonColors.textSecondary },
  event: { icon: 'calendar-outline', label: 'Event', color: CandonColors.warm },
  assignment: { icon: 'list-outline', label: 'Sign Up', color: CandonColors.primary },
  reminder: { icon: 'notifications-outline', label: 'Reminder', color: CandonColors.warning },
};

export function PostCard({ post }: { post: FamilyPost }) {
  const meta = TYPE_META[post.post_type];

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push(`/candon/family/${post.family_group_id}/post/${post.id}`)}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <View style={[s.typeBadge, { backgroundColor: meta.color + '15' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={s.time}>{timeAgo(post.created_at)}</Text>
      </View>

      <Text style={s.title}>{post.title}</Text>
      {post.body && <Text style={s.body} numberOfLines={3}>{post.body}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  typeLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  time: { fontSize: 11, color: CandonColors.textMuted },
  title: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary },
  body: { fontSize: 14, color: CandonColors.textSecondary, lineHeight: 20 },
});
