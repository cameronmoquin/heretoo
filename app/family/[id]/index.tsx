import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useFamily, useFamilyMembers, useFamilyFeed, useLeaveFamily,
} from '../../../hooks/useFamily';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { useDeletePost } from '../../../hooks/useFeed';
import { useAuthStore } from '../../../stores/authStore';
import { showConfirm } from '../../../lib/alert';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

type Tab = 'feed' | 'about';

export default function FamilyDetail() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [tab, setTab] = useState<Tab>('feed');
  const { data: family, isLoading } = useFamily(id);
  const { data: members } = useFamilyMembers(id);
  const { data: posts } = useFamilyFeed(id ?? null);
  const leave = useLeaveFamily();

  if (isLoading || !id) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!family) {
    return (
      <SafeAreaView style={s.root}>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Family not found.</Text>
          <TouchableOpacity onPress={() => router.replace('/family')} style={[s.primaryBtn, { marginTop: 16 }]}>
            <Text style={s.primaryBtnText}>Back to families</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = family.owner_id === userId;
  const onLeave = () => {
    showConfirm(
      isOwner ? 'You own this group' : 'Leave this family?',
      isOwner ? 'Owners cannot leave. Delete the family instead.' : 'You will no longer see updates.',
      () => {
        if (isOwner) return;
        leave.mutate(family.id, { onSuccess: () => router.replace('/family') });
      },
      isOwner ? 'OK' : 'Leave',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{family.name}</Text>
          <Text style={s.metaText}>
            {members?.filter((m) => m.status === 'active').length ?? 0} members
          </Text>
        </View>
        <TouchableOpacity
          style={s.newPostBtn}
          onPress={() => router.push(`/family/${id}/new-post`)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(['feed', 'about'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'feed' ? 'Feed' : 'About'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {tab === 'feed' && (
          <>
            {(!posts || posts.length === 0) ? (
              <View style={s.emptyFeed}>
                <Ionicons name="chatbubble-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyTitle}>Nothing here yet.</Text>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => router.push(`/family/${id}/new-post`)}
                >
                  <Text style={s.primaryBtnText}>Write first post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              posts.map((p: any) => <FamilyPostCard key={p.id} post={p} />)
            )}
          </>
        )}

        {tab === 'about' && (
          <>
            {!!family.description && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>About</Text>
                <Text style={s.description}>{family.description}</Text>
              </View>
            )}

            {!!(family as any).invite_code && (
              <View style={s.inviteCard}>
                <Text style={s.sectionLabel}>Invite code</Text>
                <Text style={s.inviteCode} selectable>{(family as any).invite_code}</Text>
                <Text style={s.inviteHint}>
                  Share this with someone you want to add. They enter it on the
                  Join screen and they're in.
                </Text>
                <TouchableOpacity
                  style={s.copyBtn}
                  onPress={async () => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText((family as any).invite_code);
                      showConfirm('Copied', 'Code on your clipboard.', () => {}, 'OK');
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="copy-outline" size={14} color={Colors.primary} />
                  <Text style={s.copyBtnText}>Copy code</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.sectionLabel}>Members ({members?.length ?? 0})</Text>
              {members?.map((m) => (
                <View key={m.id} style={s.memberRow}>
                  <View style={s.memberAvatar}>
                    <Ionicons name="person" size={14} color={Colors.primary} />
                  </View>
                  <Text style={s.memberText}>
                    {m.profile_id === userId ? 'You' : `${m.profile_id.slice(0, 8)}…`}
                  </Text>
                  <Text style={s.memberRole}>{m.relationship_label}</Text>
                  {m.status !== 'active' && (
                    <Text style={[s.memberRole, { color: Colors.textMuted }]}>· {m.status}</Text>
                  )}
                </View>
              ))}
            </View>

            {!isOwner && (
              <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
                <Text style={s.leaveBtnText}>Leave family</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FamilyPostCard({ post }: { post: any }) {
  const s = makeStyles();
  const author = post.author;
  const media: any[] = post.media ?? [];
  const userId = useAuthStore((st) => st.user?.id);
  const isMine = userId === post.author_id;
  const deletePost = useDeletePost();

  const onDelete = () => {
    showConfirm(
      'Delete post?',
      'This cannot be undone.',
      () => deletePost.mutate(post.id),
      'Delete',
      'Cancel',
    );
  };

  return (
    <View style={s.postCard}>
      <View style={s.postHeader}>
        <View style={s.postAvatar}>
          <Text style={s.postAvatarText}>
            {(author?.display_name ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.postAuthor}>{author?.display_name ?? 'Unknown'}</Text>
          <Text style={s.postTime}>{timeAgo(post.created_at)}</Text>
        </View>
        {isMine && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Delete post"
          >
            <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {!!post.body && <Text style={s.postBody}>{post.body}</Text>}
      {media.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {media.map((m) => (
            <Image
              key={m.id}
              source={{ uri: mediaPathToUrl(m.storage_path) }}
              style={s.postImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  metaText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  newPostBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: 10, maxWidth: 600, alignSelf: 'center', width: '100%' },
  emptyFeed: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: Colors.primary },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  description: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  memberRole: { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },
  leaveBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 },
  leaveBtnText: { color: Colors.error, fontSize: 14, fontWeight: '500' },

  postCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  postAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  postAuthor: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  postTime: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  postBody: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  postImage: {
    width: 240, height: 240, borderRadius: 8,
    marginRight: 8, backgroundColor: Colors.background,
  },
  inviteCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8, alignItems: 'center',
  },
  inviteCode: {
    fontSize: 26, fontWeight: '800', color: Colors.primary, letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginVertical: 4,
  },
  inviteHint: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', maxWidth: 320 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  copyBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
}); }
