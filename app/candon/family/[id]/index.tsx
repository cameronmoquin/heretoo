import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyGroup, useFamilyMembers, useLeaveFamilyGroup } from '../../../../hooks/useFamilyGroups';
import { useFamilyPosts } from '../../../../hooks/useFamilyPosts';
import { useAuthStore } from '../../../../stores/authStore';
import { showAlert, showConfirm } from '../../../../lib/alert';
import { CandonColors } from '../../../../constants/candon-theme';
import { PostCard } from '../../../../components/candon/PostCard';

type Tab = 'feed' | 'about';

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<Tab>('feed');
  const { data: group, isLoading } = useFamilyGroup(id);
  const { data: members } = useFamilyMembers(id);
  const { data: posts } = useFamilyPosts(id ?? null);
  const leave = useLeaveFamilyGroup();

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!group) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = group.owner_user_id === userId;

  const copyInvite = async () => {
    const code = group.invite_code ?? '';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(code);
      showAlert('Copied', `Invite code ${code} copied to clipboard.`);
    } else {
      showAlert('Invite code', code);
    }
  };

  const onLeave = () => {
    showConfirm(
      isOwner ? 'Cannot leave' : 'Leave this group?',
      isOwner
        ? 'You own this group. You cannot leave. You can delete it instead.'
        : 'You will no longer receive updates from this group.',
      () => {
        if (isOwner) return;
        leave.mutate(group.id, { onSuccess: () => router.back() });
      },
      isOwner ? 'OK' : 'Leave',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Group header (compact) */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconBox}>
            <Ionicons name="home" size={20} color={CandonColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{group.name}</Text>
            <Text style={s.metaText}>{members?.length ?? 0} members</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.newPostBtn}
          onPress={() => router.push(`/candon/family/${id}/new-post`)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['feed', 'about'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
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
                <Ionicons name="chatbubble-outline" size={32} color={CandonColors.textMuted} />
                <Text style={s.emptyFeedTitle}>Nothing here yet.</Text>
                <Text style={s.emptyFeedText}>Post an update, event, or sign-up sheet.</Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push(`/candon/family/${id}/new-post`)}
                >
                  <Text style={s.emptyBtnText}>Write first post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </>
        )}

        {tab === 'about' && (
          <>
            {!!group.description && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>Description</Text>
                <Text style={s.description}>{group.description}</Text>
              </View>
            )}

            {group.invite_code && (
              <View style={s.inviteCard}>
                <Text style={s.inviteLabel}>Invite code</Text>
                <Text style={s.inviteCode} selectable>{group.invite_code}</Text>
                <TouchableOpacity style={s.inviteBtn} onPress={copyInvite}>
                  <Ionicons name="copy-outline" size={14} color={CandonColors.primary} />
                  <Text style={s.inviteBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.sectionLabel}>Members ({members?.length ?? 0})</Text>
              {members?.map((m) => (
                <View key={m.id} style={s.memberRow}>
                  <View style={s.memberAvatar}>
                    <Ionicons name="person" size={14} color={CandonColors.primary} />
                  </View>
                  <Text style={s.memberText}>
                    {m.user_id === userId ? 'You' : `${m.user_id.slice(0, 8)}…`}
                  </Text>
                  <Text style={s.memberRole}>{m.role}</Text>
                </View>
              ))}
            </View>

            {/* Spin off — only members can spawn a child family */}
            <View style={s.spinoffCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.spinoffTitle}>Spin off a new family</Text>
                <Text style={s.spinoffText}>
                  Start a separate, private family group connected to this one.
                  The two stay independent, but the connection contributes to
                  the public family-tree network stats.
                </Text>
              </View>
              <TouchableOpacity
                style={s.spinoffBtn}
                onPress={() => router.push(`/candon/family/new?from=${group.id}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="git-branch-outline" size={16} color="#FFF" />
                <Text style={s.spinoffBtnText}>Spin off</Text>
              </TouchableOpacity>
            </View>

            {!isOwner && (
              <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
                <Text style={s.leaveBtnText}>Leave group</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  empty: { padding: 40, textAlign: 'center', color: CandonColors.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary },
  metaText: { fontSize: 12, color: CandonColors.textMuted },
  newPostBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CandonColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: CandonColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: CandonColors.primary },
  tabText: { fontSize: 14, color: CandonColors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: CandonColors.primary, fontWeight: '600' },

  scroll: { padding: 16, gap: 10, maxWidth: 600, alignSelf: 'center', width: '100%' },

  emptyFeed: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyFeedTitle: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 6 },
  emptyFeedText: { fontSize: 13, color: CandonColors.textSecondary, textAlign: 'center' },
  emptyBtn: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: CandonColors.primary },
  emptyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, gap: 8,
  },
  description: { fontSize: 14, color: CandonColors.textPrimary, lineHeight: 20 },
  inviteCard: {
    backgroundColor: CandonColors.primaryFaint, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: CandonColors.primary, alignItems: 'center', gap: 6,
  },
  inviteLabel: { fontSize: 11, fontWeight: '600', color: CandonColors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  inviteCode: { fontSize: 22, fontWeight: '700', color: CandonColors.primary, letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.primary,
  },
  inviteBtnText: { color: CandonColors.primary, fontSize: 13, fontWeight: '500' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberText: { fontSize: 14, color: CandonColors.textPrimary, flex: 1 },
  memberRole: { fontSize: 11, color: CandonColors.textMuted, textTransform: 'capitalize' },
  leaveBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 },
  leaveBtnText: { color: CandonColors.error, fontSize: 14, fontWeight: '500' },
  spinoffCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border,
  },
  spinoffTitle: { fontSize: 14, fontWeight: '600', color: CandonColors.textPrimary },
  spinoffText: { fontSize: 12, color: CandonColors.textMuted, marginTop: 4, lineHeight: 17 },
  spinoffBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
    backgroundColor: CandonColors.primary,
  },
  spinoffBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
