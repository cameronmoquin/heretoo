import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CandonColors } from '../../constants/candon-theme';
import type { FamilyPost } from '../../hooks/useFamilyPosts';
import type { IoniconName } from '../../lib/icon-types';

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

const TYPE_META: Record<FamilyPost['post_type'], { icon: IoniconName; label: string; color: string }> = {
  general_update: { icon: 'chatbubble-outline', label: 'Update', color: CandonColors.textSecondary },
  event: { icon: 'calendar-outline', label: 'Event', color: CandonColors.warm },
  assignment: { icon: 'list-outline', label: 'Sign Up', color: CandonColors.primary },
  reminder: { icon: 'notifications-outline', label: 'Reminder', color: CandonColors.warning },
  medical_update: { icon: 'medkit-outline', label: 'Medical', color: CandonColors.medical },
};

const SCOPE_ICON: Record<FamilyPost['visibility_scope'], IoniconName | null> = {
  group: null,
  selected_members: 'person-outline',
  admins_only: 'shield-outline',
  medical_limited: 'lock-closed-outline',
};

export function PostCard({ post }: { post: FamilyPost }) {
  const meta = TYPE_META[post.post_type];
  const scopeIcon = SCOPE_ICON[post.visibility_scope];
  const isMedical = post.post_type === 'medical_update';

  return (
    <TouchableOpacity
      style={[
        s.card,
        isMedical && { borderLeftWidth: 3, borderLeftColor: CandonColors.medical, paddingLeft: 11 },
      ]}
      onPress={() => router.push(`/candon/family/${post.family_group_id}/post/${post.id}`)}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <View style={[s.typeBadge, { backgroundColor: meta.color + '15' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {scopeIcon && (
          <View style={s.scopeChip}>
            <Ionicons name={scopeIcon} size={11} color={CandonColors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={s.time}>{timeAgo(post.created_at)}</Text>
      </View>

      <Text style={s.title}>{post.title}</Text>
      {post.body && <Text style={s.body} numberOfLines={3}>{post.body}</Text>}

      {/* Media preview: first photo, or video thumbnail with play badge */}
      {post.photo_urls && post.photo_urls.length > 0 && (
        <View style={s.mediaWrap}>
          <Image source={{ uri: post.photo_urls[0] }} style={s.mediaImg} resizeMode="cover" />
          {post.photo_urls.length > 1 && (
            <View style={s.mediaCount}>
              <Ionicons name="copy-outline" size={11} color="#FFF" />
              <Text style={s.mediaCountText}>{post.photo_urls.length}</Text>
            </View>
          )}
        </View>
      )}
      {!post.photo_urls?.length && post.mux_playback_id && (
        <View style={s.mediaWrap}>
          {post.mux_thumbnail_url ? (
            <Image source={{ uri: post.mux_thumbnail_url }} style={s.mediaImg} resizeMode="cover" />
          ) : (
            <View style={[s.mediaImg, { backgroundColor: '#000' }]} />
          )}
          <View style={s.playBadge}>
            <Ionicons name="play" size={20} color="#FFF" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, gap: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  typeLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  scopeChip: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: CandonColors.surfaceRaise,
    alignItems: 'center', justifyContent: 'center',
  },
  time: { fontSize: 11, color: CandonColors.textMuted },
  title: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary },
  body: { fontSize: 14, color: CandonColors.textSecondary, lineHeight: 20 },
  mediaWrap: {
    marginTop: 6, position: 'relative',
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: CandonColors.surfaceRaise,
  },
  mediaImg: { width: '100%', aspectRatio: 16 / 9 },
  mediaCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mediaCountText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  playBadge: {
    position: 'absolute', top: '50%', left: '50%',
    transform: [{ translateX: -22 }, { translateY: -22 }],
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
});
