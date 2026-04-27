import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useFamilyGroup, useFamilyMembers, useFamilyFeed,
  useLeaveFamilyGroup,
  type FamilyCategory,
} from '../../../hooks/useFamily';
import { useAuthStore } from '../../../stores/authStore';
import { showAlert, showConfirm } from '../../../lib/alert';
import { PostCard } from '../../../components/feed/PostCard';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

type Tab = 'all' | 'medical' | 'holiday' | 'party' | 'about';

const TABS: { id: Tab; label: string; icon: any; category: FamilyCategory | 'all' | null }[] = [
  { id: 'all',     label: 'Feed',     icon: 'list',                       category: 'all' },
  { id: 'medical', label: 'Medical',  icon: 'medkit-outline',             category: 'medical' },
  { id: 'holiday', label: 'Holidays', icon: 'gift-outline',               category: 'holiday' },
  { id: 'party',   label: 'Parties',  icon: 'wine-outline',               category: 'party' },
  { id: 'about',   label: 'About',    icon: 'information-circle-outline', category: null },
];

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<Tab>('all');
  const { data: group, isLoading } = useFamilyGroup(id);
  const { data: members } = useFamilyMembers(id);
  const activeCategory: FamilyCategory | 'all' =
    tab === 'all' || tab === 'about' ? 'all' : (tab as FamilyCategory);
  const { data: posts } = useFamilyFeed(id ?? null, activeCategory);
  const leave = useLeaveFamilyGroup();

  if (isLoading || !id) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!group) {
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

  const isOwner = group.created_by === userId;

  const copyInvite = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(group.invite_code);
      showAlert('Copied', `Invite code ${group.invite_code} copied.`);
    } else {
      showAlert('Invite code', group.invite_code);
    }
  };

  const onLeave = () => {
    showConfirm(
      isOwner ? 'You own this group' : 'Leave this family?',
      isOwner
        ? 'Owners cannot leave. You can delete the family instead.'
        : 'You will no longer see updates from this family.',
      () => {
        if (isOwner) return;
        leave.mutate(group.id, { onSuccess: () => router.replace('/family') });
      },
      isOwner ? 'OK' : 'Leave',
    );
  };

  const accent = group.theme_primary ?? Colors.primary;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* Header */}
      <View style={[s.header, !!group.theme_primary && { borderLeftWidth: 4, borderLeftColor: accent }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{group.name}</Text>
          {group.motto ? (
            <Text style={[s.motto, { color: accent }]}>{group.motto}</Text>
          ) : (
            <Text style={s.metaText}>{members?.length ?? 0} members</Text>
          )}
        </View>
        <TouchableOpacity
          style={[s.newPostBtn, { backgroundColor: accent }]}
          onPress={() => router.push(`/family/${id}/new-post${tab !== 'all' && tab !== 'about' ? `?category=${tab}` : ''}` as any)}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsScroll}
        style={s.tabsContainer}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, active && { borderBottomColor: accent }]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.75}
            >
              <Ionicons name={t.icon} size={14} color={active ? accent : Colors.textSecondary} />
              <Text style={[s.tabText, active && { color: accent, fontWeight: '600' }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll}>
        {tab !== 'about' && (
          <>
            {(!posts || posts.length === 0) ? (
              <View style={s.emptyFeed}>
                <Ionicons
                  name={
                    tab === 'medical' ? 'medkit-outline'
                    : tab === 'holiday' ? 'gift-outline'
                    : tab === 'party' ? 'wine-outline'
                    : 'chatbubble-outline'
                  }
                  size={32}
                  color={Colors.textMuted}
                />
                <Text style={s.emptyTitle}>
                  {tab === 'medical' ? 'No medical updates yet.'
                    : tab === 'holiday' ? 'No holiday plans yet.'
                    : tab === 'party'   ? 'No parties yet.'
                    : 'Nothing here yet.'}
                </Text>
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: accent }]}
                  onPress={() => router.push(`/family/${id}/new-post${tab !== 'all' ? `?category=${tab}` : ''}` as any)}
                >
                  <Text style={s.primaryBtnText}>Write first post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              posts.map((p: any) => <PostCard key={p.id} post={p} onEngage={() => {}} />)
            )}
          </>
        )}

        {tab === 'about' && (
          <>
            {!!group.description && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>About</Text>
                <Text style={s.description}>{group.description}</Text>
              </View>
            )}

            <View style={s.inviteCard}>
              <Text style={s.inviteLabel}>Invite code</Text>
              <Text style={s.inviteCode} selectable>{group.invite_code}</Text>
              <TouchableOpacity style={s.inviteBtn} onPress={copyInvite}>
                <Ionicons name="copy-outline" size={14} color={accent} />
                <Text style={[s.inviteBtnText, { color: accent }]}>Copy</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <Text style={s.sectionLabel}>Members ({members?.length ?? 0})</Text>
              {members?.map((m) => (
                <View key={m.id} style={s.memberRow}>
                  <View style={s.memberAvatar}>
                    <Ionicons name="person" size={14} color={Colors.primary} />
                  </View>
                  <Text style={s.memberText}>
                    {m.user_id === userId ? 'You' : `${m.user_id.slice(0, 8)}…`}
                  </Text>
                  <Text style={s.memberRole}>{m.role}</Text>
                </View>
              ))}
            </View>

            <View style={s.spinoffCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.spinoffTitle}>Spin off a new family</Text>
                <Text style={s.spinoffText}>
                  Start a new family connected to this one. Stays private from this group.
                </Text>
              </View>
              <TouchableOpacity
                style={[s.spinoffBtn, { backgroundColor: accent }]}
                onPress={() => router.push(`/family/new?from=${group.id}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="git-branch-outline" size={16} color="#FFF" />
                <Text style={s.spinoffBtnText}>Spin off</Text>
              </TouchableOpacity>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  metaText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  motto: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  newPostBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  tabsContainer: {
    flexGrow: 0,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tabsScroll: { paddingHorizontal: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  scroll: { padding: Spacing.md, gap: 10, maxWidth: 600, alignSelf: 'center', width: '100%' },
  emptyFeed: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: 6 },

  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  description: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },

  inviteCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 16,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 6,
  },
  inviteLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  inviteCode: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
  },
  inviteBtnText: { fontSize: 13, fontWeight: '500' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  memberRole: { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },

  spinoffCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  spinoffTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  spinoffText: { fontSize: 12, color: Colors.textMuted, marginTop: 4, lineHeight: 17 },
  spinoffBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
  },
  spinoffBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  leaveBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 },
  leaveBtnText: { color: Colors.error, fontSize: 14, fontWeight: '500' },

  primaryBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
