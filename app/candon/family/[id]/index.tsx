import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyGroup, useFamilyMembers, useLeaveFamilyGroup } from '../../../../hooks/useFamilyGroups';
import { useFamilyPosts, type PostCategory } from '../../../../hooks/useFamilyPosts';
import { useAuthStore } from '../../../../stores/authStore';
import { showAlert, showConfirm } from '../../../../lib/alert';
import { CandonColors } from '../../../../constants/candon-theme';
import { PostCard } from '../../../../components/candon/PostCard';
import { FamilyCrest } from '../../../../components/candon/FamilyCrest';

// Top-level family tabs:
//   all      → every post in the group
//   medical  → medical updates only
//   holiday  → holiday-tagged posts (with optional Planning sub-tab)
//   party    → party-tagged posts (with optional Planning sub-tab)
//   about    → group settings, members, invite, spin off
type Tab = 'all' | 'medical' | 'holiday' | 'party' | 'about';

const FEED_TABS: { id: Tab; label: string; icon: any; category: PostCategory | 'all' | null }[] = [
  { id: 'all',     label: 'Feed',     icon: 'list',           category: 'all' },
  { id: 'medical', label: 'Medical',  icon: 'medkit-outline', category: 'medical' },
  { id: 'holiday', label: 'Holidays', icon: 'gift-outline',   category: 'holiday' },
  { id: 'party',   label: 'Parties',  icon: 'wine-outline',   category: 'party' },
  { id: 'about',   label: 'About',    icon: 'information-circle-outline', category: null },
];

// Sub-tabs for the Holiday and Party tabs.
type SubTab = 'updates' | 'planning';

function DeletedGroupRedirect() {
  useEffect(() => {
    // Replace, don't push, so the user can't "back" into the dead URL.
    router.replace('/candon/family');
  }, []);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CandonColors.bg }}>
      <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
    </SafeAreaView>
  );
}

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<Tab>('all');
  const [subTab, setSubTab] = useState<SubTab>('updates');
  const { data: group, isLoading } = useFamilyGroup(id);
  const { data: members } = useFamilyMembers(id);
  const activeCategory: PostCategory | 'all' =
    tab === 'all' || tab === 'about'
      ? 'all'
      : (tab as PostCategory);
  const { data: posts } = useFamilyPosts(id ?? null, activeCategory);
  const leave = useLeaveFamilyGroup();

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!group) {
    // Group was deleted (or stale link from cache). Bounce to family list,
    // which forces a fresh query and avoids attempts to post into a ghost.
    return <DeletedGroupRedirect />;
  }

  const isOwner = group.owner_user_id === userId;
  const myMember = members?.find((m) => m.user_id === userId);
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  function tintBg(hex: string): string {
    // 12% mix on the surface — header tint for that family's color.
    return `${hex}14`; // hex + alpha 0x14 (~8% opacity)
  }

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
      {/* Group header (compact). Honors per-family theme color when set. */}
      <View style={[s.header, !!group.theme_primary && { backgroundColor: tintBg(group.theme_primary) }]}>
        <View style={s.headerLeft}>
          <FamilyCrest
            seed={group.id}
            name={group.name}
            size={44}
            paletteIndex={group.crest_palette_index ?? undefined}
            division={(group.crest_division as any) ?? undefined}
            charge={(group.crest_charge as any) ?? undefined}
          />
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={s.name}>{group.name}</Text>
            {group.motto ? (
              <Text style={[s.motto, !!group.theme_primary && { color: group.theme_primary }]}>
                {group.motto}
              </Text>
            ) : (
              <Text style={s.metaText}>{members?.length ?? 0} members</Text>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {(isOwner || isAdmin) && (
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push(`/candon/family/${id}/customize`)}
              accessibilityLabel="Customize family"
              activeOpacity={0.7}
            >
              <Ionicons name="color-palette-outline" size={18} color={CandonColors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.newPostBtn, !!group.theme_primary && { backgroundColor: group.theme_primary }]}
            onPress={() => router.push(`/candon/family/${id}/new-post`)}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top-level tab bar — horizontal scroll on small screens */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsScroll}
        style={s.tabsContainer}
      >
        {FEED_TABS.map((t) => {
          const active = tab === t.id;
          const accent = group.theme_primary ?? CandonColors.primary;
          return (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, active && s.tabActive, active && { borderBottomColor: accent }]}
              onPress={() => { setTab(t.id); setSubTab('updates'); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? accent : CandonColors.textSecondary}
              />
              <Text style={[s.tabText, active && { color: accent, fontWeight: '600' }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sub-tabs for Holiday and Party (Updates / Planning) */}
      {(tab === 'holiday' || tab === 'party') && (
        <View style={s.subTabRow}>
          {(['updates', 'planning'] as SubTab[]).map((st) => (
            <TouchableOpacity
              key={st}
              style={[s.subTab, subTab === st && s.subTabActive]}
              onPress={() => setSubTab(st)}
              activeOpacity={0.75}
            >
              <Text style={[s.subTabText, subTab === st && s.subTabTextActive]}>
                {st === 'updates' ? 'Updates' : 'Planning'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Feed-style tabs (all / medical / holiday Updates / party Updates) */}
        {tab !== 'about' && !((tab === 'holiday' || tab === 'party') && subTab === 'planning') && (
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
                  color={CandonColors.textMuted}
                />
                <Text style={s.emptyFeedTitle}>
                  {tab === 'medical' ? 'No medical updates yet.'
                    : tab === 'holiday' ? 'No holiday plans yet.'
                    : tab === 'party' ? 'No party plans yet.'
                    : 'Nothing here yet.'}
                </Text>
                <Text style={s.emptyFeedText}>
                  {tab === 'medical' ? 'Share patient updates, status changes, and what help is needed.'
                    : tab === 'holiday' ? 'Plan a holiday gathering — sign-up sheets, RSVPs, updates.'
                    : tab === 'party' ? 'Plan a party — invitations, sign-ups, day-of updates.'
                    : 'Post an update, event, or sign-up sheet.'}
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => {
                    const cat = tab === 'all' ? '' : `?category=${tab}`;
                    router.push(`/candon/family/${id}/new-post${cat}` as any);
                  }}
                >
                  <Text style={s.emptyBtnText}>Write first post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </>
        )}

        {/* Planning sub-tab placeholder — Holidays & Parties */}
        {(tab === 'holiday' || tab === 'party') && subTab === 'planning' && (
          <View style={s.planningCard}>
            <View style={s.planningIcon}>
              <Ionicons
                name={tab === 'holiday' ? 'gift' : 'wine'}
                size={22}
                color={CandonColors.primary}
              />
            </View>
            <Text style={s.planningTitle}>
              Planning · {tab === 'holiday' ? 'Holidays' : 'Parties'}
            </Text>
            <Text style={s.planningText}>
              The planning workspace is coming next: shared sign-up sheets, RSVPs, a running
              checklist that any family member can edit. For now, post a {tab === 'holiday' ? 'Holiday' : 'Party'} update
              or sign-up sheet from the &quot;+&quot; button — anything you post in this category
              shows up under <Text style={{ fontWeight: '600' }}>Updates</Text> here and in the main feed.
            </Text>
            <TouchableOpacity
              style={s.planningCta}
              onPress={() =>
                router.push(`/candon/family/${id}/new-post?category=${tab}` as any)
              }
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={s.planningCtaText}>
                Start a {tab === 'holiday' ? 'holiday' : 'party'} thread
              </Text>
            </TouchableOpacity>
          </View>
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
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  motto: {
    fontSize: 13, fontStyle: 'italic',
    color: CandonColors.textSecondary, marginTop: 2,
  },

  tabsContainer: {
    flexGrow: 0,
    backgroundColor: CandonColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.border,
  },
  tabsScroll: { paddingHorizontal: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 13, color: CandonColors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: CandonColors.primary, fontWeight: '600' },

  subTabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: CandonColors.surfaceRaise,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.border,
  },
  subTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  subTabActive: { backgroundColor: CandonColors.primary, borderColor: CandonColors.primary },
  subTabText: { fontSize: 12, color: CandonColors.textPrimary, fontWeight: '500' },
  subTabTextActive: { color: '#FFF', fontWeight: '600' },

  planningCard: {
    backgroundColor: CandonColors.surface, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: CandonColors.border, alignItems: 'center', gap: 10,
  },
  planningIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  planningTitle: { fontSize: 16, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 4 },
  planningText: {
    fontSize: 13, color: CandonColors.textSecondary,
    textAlign: 'center', lineHeight: 19, maxWidth: 360,
  },
  planningCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CandonColors.primary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    marginTop: 8,
  },
  planningCtaText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

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
