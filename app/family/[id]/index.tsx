import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Pressable, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFamily, useFamilyMembers, useFamilyFeed, useLeaveFamily,
  useDeleteFamily, usePendingRename, useProposeRename, useVoteRename,
} from '../../../hooks/useFamily';
import { useSubjectsNewActivity } from '../../../hooks/useSubjects';
import { useToggleHeart } from '../../../hooks/useFeed';
import { useAuthStore } from '../../../stores/authStore';
import { goBackToFeed } from '../../../lib/nav';
import { showAlert, showConfirm } from '../../../lib/alert';
import { FeedComposer } from '../../../components/feed/FeedComposer';
import { PostCard } from '../../../components/feed/PostCard';
import { FamilyChatPanel } from '../../../components/family/FamilyChatPanel';
import { SubjectsPanel } from '../../../components/subjects/SubjectsPanel';
import { FamilyTriviaPanel } from '../../../components/trivia/FamilyTriviaPanel';
import { useStartVideoCall } from '../../../hooks/useStartVideoCall';
import { Button } from '../../../components/shared/Button';
import { Eyebrow } from '../../../components/shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

type Tab = 'feed' | 'subjects' | 'chat' | 'trivia' | 'about';

export default function FamilyDetail() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [tab, setTab] = useState<Tab>('feed');
  const { data: family, isLoading } = useFamily(id);
  const { data: members } = useFamilyMembers(id);
  const { data: posts } = useFamilyFeed(id ?? null);
  // New-activity signal for the Subjects tab badge ("something's happening").
  const subjectsActivity = useSubjectsNewActivity(id ?? null);
  const leave = useLeaveFamily();
  const deleteFamily = useDeleteFamily();
  const toggleHeart = useToggleHeart();
  const { data: pendingRename } = usePendingRename(id ?? null);
  const proposeRename = useProposeRename();
  const voteRename = useVoteRename();
  const startCall = useStartVideoCall();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['family', id] }),
        qc.invalidateQueries({ queryKey: ['family-members', id] }),
        qc.invalidateQueries({ queryKey: ['family-feed', id] }),
        qc.invalidateQueries({ queryKey: ['family-subjects', id] }),
        qc.invalidateQueries({ queryKey: ['subject-activity', id] }),
        qc.invalidateQueries({ queryKey: ['pending-rename', id] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

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
          <Text style={{ color: Colors.textMuted }}>{Vocab.Group} not found.</Text>
          <Button
            title={`Back to your ${Vocab.groupPlural}`}
            onPress={() => router.replace('/family')}
            style={s.primaryBtn}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = family.owner_id === userId;
  const activeMembers = members?.filter((m) => m.status === 'active') ?? [];
  const isSoloMember = activeMembers.length <= 1;
  const totalActive = activeMembers.length;
  const yesCount = pendingRename?.votes?.filter((v) => v.vote).length ?? 0;
  const noCount = pendingRename?.votes?.filter((v) => !v.vote).length ?? 0;
  const myVote = pendingRename?.votes?.find((v) => v.voter_id === userId);
  const yesNeeded = Math.max(1, Math.floor(totalActive / 2) + 1);

  const onProposeRename = () => {
    const next = renameDraft.trim();
    if (next.length < 2) {
      showAlert('Too short', 'Pick a name with at least 2 characters.');
      return;
    }
    if (next === family.name) {
      showAlert('Same name', `That's already this ${Vocab.group}'s name.`);
      return;
    }
    proposeRename.mutate(
      { familyId: family.id, newName: next },
      {
        onSuccess: () => { setRenameOpen(false); setRenameDraft(''); },
        onError: (e: any) => showAlert('Could not propose', e?.message ?? 'Try again.'),
      },
    );
  };

  const onDeleteFamily = () => {
    showConfirm(
      `Delete this ${Vocab.group}?`,
      `This is permanent. Every ${Vocab.post} and all chat history goes with it. Allowed only because you're the only member.`,
      () => {
        deleteFamily.mutate(family.id, {
          onSuccess: () => router.replace('/family' as any),
          onError: (e: any) => showAlert('Could not delete', e?.message ?? 'Try again.'),
        });
      },
      'Delete forever',
      'Cancel',
    );
  };

  const onLeave = () => {
    showConfirm(
      isOwner ? 'You own this group' : `Leave this ${Vocab.group}?`,
      isOwner
        ? `Owners stay. Delete the ${Vocab.group} instead.`
        : 'Updates stop here for you.',
      () => {
        if (isOwner) return;
        leave.mutate(family.id, { onSuccess: () => router.replace('/family') });
      },
      isOwner ? 'OK' : 'Leave',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => goBackToFeed()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityLabel="Back to HereToo"
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          <Text style={s.backBtnText}>HereToo</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{family.name}</Text>
          <Text style={s.metaText}>
            {members?.filter((m) => m.status === 'active').length ?? 0} members
          </Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(['feed', 'subjects', 'chat', 'trivia', 'about'] as Tab[]).map((t) => {
          const label =
            t === 'feed' ? 'Feed' :
            t === 'subjects' ? 'Subjects' :
            t === 'chat' ? 'Chat' :
            t === 'trivia' ? 'Trivia' :
            'About';
          const showDot = t === 'subjects' && subjectsActivity.anyNew && tab !== 'subjects';
          return (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <View style={s.tabLabelRow}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>{label}</Text>
                {showDot && <View style={s.tabBadge} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {tab === 'feed' && (
          <>
            {/* Everything is free for now (monetization comes later), so
                the subscription banner is not rendered. Restore
                <FamilyBillingBanner familyId={id} isOwner={isOwner} />
                when billing turns back on. */}
            {/* Invite shortcut — same share flow that's also on the About tab,
                but here on the Feed tab so it's discoverable without hunting. */}
            {!!(family as any).invite_code && (
              <TouchableOpacity
                style={s.feedInviteBtn}
                activeOpacity={0.85}
                onPress={async () => {
                  const code = (family as any).invite_code;
                  const origin =
                    typeof window !== 'undefined' && window.location?.origin
                      ? window.location.origin
                      : 'https://heretoo.social';
                  const url = `${origin}/join/${code}`;
                  const shareText = `Join the ${family.name} ${Vocab.group} on HereToo: ${url}`;
                  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
                  if (nav?.share) {
                    try { await nav.share({ title: family.name, text: shareText, url }); return; } catch {}
                  }
                  if (nav?.clipboard) {
                    await nav.clipboard.writeText(url);
                    showConfirm('Link copied', url, () => {}, 'OK');
                  }
                }}
              >
                <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
                <Text style={s.feedInviteText}>Invite others to {family.name}</Text>
                <Ionicons name="share-outline" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {/* M9: welcome ceremony for someone NOT yet on HereToo. Different
                from "Invite others" — that copies a join URL; this generates
                a personalized voice greeting that addresses the recipient
                by name. The Lob print pipeline is a follow-up. */}
            <TouchableOpacity
              style={s.welcomeCardBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/family/${id}/invite-card` as any)}
            >
              <Ionicons name="mail-outline" size={16} color={Colors.textSecondary} />
              <Text style={s.welcomeCardText}>Send a welcome card</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
            {/* Video calls live in messaging now (Aug 2026). The button
                that sat here started a whole-cohort call; the call icon
                in a message thread's header is the door. */}
            <FeedComposer familyId={id} />
            {(!posts || posts.length === 0) ? (
              <View style={s.emptyFeed}>
                <Ionicons name="chatbubble-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyTitle}>Nothing here yet.</Text>
              </View>
            ) : (
              posts.map((p: any) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onHeart={(postId) => toggleHeart.mutate(postId)}
                />
              ))
            )}
          </>
        )}

        {/* Subjects. The long-running crew-story threads. Replaces
            the old Updates tab. Source of Truth, Milestone 3. */}
        {tab === 'subjects' && (
          <SubjectsPanel familyId={id} />
        )}

        {tab === 'chat' && (
          <FamilyChatPanel familyId={id} />
        )}

        {tab === 'trivia' && (
          <FamilyTriviaPanel familyId={id} />
        )}

        {tab === 'about' && (
          <>
            {/* Active rename proposal. Shown to everyone in the crew. */}
            {pendingRename?.proposal && (
              <View style={s.proposalCard}>
                <Eyebrow style={s.sectionLabel}>Pending rename</Eyebrow>
                <Text style={s.proposalText}>
                  Someone proposed renaming this {Vocab.group} to{'\n'}
                  <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                    "{pendingRename.proposal.proposed_name}"
                  </Text>
                </Text>
                <Text style={s.proposalTally}>
                  {yesCount} yes · {noCount} no · {yesNeeded} needed of {totalActive} members
                </Text>
                <View style={s.voteRow}>
                  <TouchableOpacity
                    style={[s.voteBtn, myVote?.vote === false && s.voteBtnNoActive]}
                    onPress={() =>
                      voteRename.mutate({
                        proposalId: pendingRename.proposal!.id,
                        vote: false,
                        familyId: family.id,
                      })
                    }
                  >
                    <Ionicons name="close" size={16} color={myVote?.vote === false ? '#FFF' : Colors.textPrimary} />
                    <Text style={[s.voteBtnText, myVote?.vote === false && { color: '#FFF' }]}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.voteBtn, myVote?.vote === true && s.voteBtnYesActive]}
                    onPress={() =>
                      voteRename.mutate({
                        proposalId: pendingRename.proposal!.id,
                        vote: true,
                        familyId: family.id,
                      })
                    }
                  >
                    <Ionicons name="checkmark" size={16} color={myVote?.vote === true ? Colors.onPrimary : Colors.textPrimary} />
                    <Text style={[s.voteBtnText, myVote?.vote === true && { color: Colors.onPrimary }]}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!!family.description && (
              <View style={s.card}>
                <Eyebrow style={s.sectionLabel}>About</Eyebrow>
                <Text style={s.description}>{family.description}</Text>
              </View>
            )}

            {!!(family as any).invite_code && (
              <View style={s.inviteCard}>
                <Eyebrow style={s.sectionLabel}>Invite code</Eyebrow>
                <Text style={s.inviteCode} selectable>{(family as any).invite_code}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    title="Copy code"
                    variant="ghost"
                    size="sm"
                    icon={<Ionicons name="copy-outline" size={14} color={Colors.primary} />}
                    style={s.copyBtn}
                    onPress={async () => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText((family as any).invite_code);
                        showConfirm('Copied', 'Code on your clipboard.', () => {}, 'OK');
                      }
                    }}
                  />

                  <Button
                    title="Share invite link"
                    variant="ghost"
                    size="sm"
                    icon={<Ionicons name="share-outline" size={14} color={Colors.primary} />}
                    style={s.copyBtn}
                    onPress={async () => {
                      const code = (family as any).invite_code;
                      const origin =
                        typeof window !== 'undefined' && window.location?.origin
                          ? window.location.origin
                          : 'https://heretoo.social';
                      const url = `${origin}/join/${code}`;
                      const shareText = `Join the ${family.name} ${Vocab.group} on HereToo: ${url}`;
                      // Prefer the native share sheet when available (mobile + some desktop browsers).
                      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
                      if (nav?.share) {
                        try {
                          await nav.share({ title: family.name, text: shareText, url });
                          return;
                        } catch {
                          // user cancelled or share unavailable — fall through to clipboard
                        }
                      }
                      if (nav?.clipboard) {
                        await nav.clipboard.writeText(url);
                        showConfirm('Link copied', `${url}`, () => {}, 'OK');
                      }
                    }}
                  />
                </View>
              </View>
            )}

            <View style={s.card}>
              <Eyebrow style={s.sectionLabel}>Members ({members?.length ?? 0})</Eyebrow>
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

            {/* Active-member actions: anyone can propose a rename */}
            {!pendingRename?.proposal && (
              <Button
                title="Propose new name"
                variant="outline"
                size="sm"
                icon={<Ionicons name="create-outline" size={16} color={Colors.textPrimary} />}
                style={s.secondaryBtn}
                onPress={() => { setRenameDraft(family.name); setRenameOpen(true); }}
              />
            )}

            {!isOwner && (
              <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
                <Text style={s.leaveBtnText}>Leave {Vocab.group}</Text>
              </TouchableOpacity>
            )}

            {/* Owner-only: delete only allowed when no other active members */}
            {isOwner && isSoloMember && (
              <TouchableOpacity style={s.deleteBtn} onPress={onDeleteFamily} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={15} color="#FFF" />
                <Text style={s.deleteBtnText}>Delete this {Vocab.group}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* Rename proposal modal */}
      <Modal
        visible={renameOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameOpen(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setRenameOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Propose a new name</Text>
            <TextInput
              style={s.modalInput}
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder={`New ${Vocab.group} name`}
              placeholderTextColor={Colors.textMuted}
              maxLength={80}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={onProposeRename}
            />
            <View style={s.modalRow}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                onPress={() => setRenameOpen(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, proposeRename.isPending && { opacity: 0.5 }]}
                onPress={onProposeRename}
                disabled={proposeRename.isPending}
              >
                <Text style={s.modalBtnPrimaryText}>
                  {proposeRename.isPending ? 'Submitting…' : 'Propose'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  metaText: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 2,
  },
  newPostBtn: {
    width: 36, height: 36, borderRadius: Radius.xs, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 4, paddingVertical: 4, marginRight: 4,
  },
  backBtnText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    color: Colors.textPrimary, fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    color: Colors.textSecondary, fontWeight: '500',
  },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabBadge: {
    width: 7, height: 7, borderRadius: Radius.full, backgroundColor: Colors.primary,
  },
  scroll: { padding: Spacing.md, gap: 10, maxWidth: 600, alignSelf: 'center', width: '100%' },
  emptyFeed: { alignItems: 'center', paddingTop: 40, gap: Spacing.sm },
  feedInviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
    alignSelf: 'flex-start',
    marginTop: 6, marginBottom: Spacing.xxs,
  },
  feedInviteText: { fontSize: 13, fontWeight: '600', color: Colors.primary, flexShrink: 1 },
  welcomeCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    alignSelf: 'flex-start',
    marginTop: Spacing.xxs, marginBottom: Spacing.xxs,
  },
  welcomeCardText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flexShrink: 1 },
  callBtn: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.xxs, marginBottom: Spacing.xxs,
  },
  emptyTitle: {
    fontSize: Type.bodyBold.size, fontWeight: '600', color: Colors.textPrimary,
  },
  primaryBtn: { borderRadius: Radius.full, marginTop: Spacing.md },

  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs,
  },
  description: {
    fontSize: Type.ui.size, color: Colors.textPrimary, lineHeight: 20,
  },
  sectionLabel: { marginBottom: Spacing.xxs },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberAvatar: {
    width: 28, height: 28, borderRadius: Radius.xs, backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberText: { fontSize: Type.ui.size, color: Colors.textPrimary, flex: 1 },
  memberRole: {
    fontSize: Type.eyebrow.size, color: Colors.textMuted, textTransform: 'capitalize',
  },
  leaveBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, marginTop: Spacing.xs },
  leaveBtnText: { color: Colors.error, fontSize: Type.ui.size, fontWeight: '500' },

  emptySub: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center',
    maxWidth: 320, marginTop: 6, lineHeight: 19,
  },

  // Rename proposal banner
  proposalCard: {
    backgroundColor: Colors.primaryFaint,
    borderColor: Colors.primary, borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14, gap: 8,
  },
  proposalText: {
    fontSize: Type.ui.size, color: Colors.textSecondary, lineHeight: 19,
  },
  proposalTally: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted,
  },
  voteRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xxs },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: Spacing.xs, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  voteBtnText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  voteBtnYesActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  voteBtnNoActive: { backgroundColor: Colors.error, borderColor: Colors.error },

  // Rename + delete buttons in About footer
  secondaryBtn: {
    alignSelf: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    marginTop: Spacing.xs,
  },
  deleteBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.error,
    marginTop: Spacing.xs,
  },
  deleteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Rename proposal modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.control,
    width: '100%', maxWidth: 420, padding: 18, gap: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: Type.bodyBold.size, fontWeight: Type.bodyBold.weight, color: Colors.textPrimary,
  },
  modalInput: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
    marginTop: Spacing.xxs,
  },
  modalRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 6 },
  modalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: Radius.full,
    alignItems: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: Colors.border },
  modalBtnGhostText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: Colors.primary },
  modalBtnPrimaryText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 13 },

  postCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: {
    width: 36, height: 36, borderRadius: Radius.xs,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  postAvatarText: { color: Colors.onPrimary, fontSize: Type.ui.size, fontWeight: '700' },
  postAuthor: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  postTime: { fontSize: Type.eyebrow.size, color: Colors.textMuted, marginTop: 1 },
  postBody: { fontSize: Type.ui.size, color: Colors.textPrimary, lineHeight: 20 },
  postImage: {
    width: 240, height: 240, borderRadius: 8,
    marginRight: Spacing.xs, backgroundColor: Colors.background,
  },
  inviteCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs, alignItems: 'center',
  },
  inviteCode: {
    fontSize: 26, fontWeight: '800', color: Colors.primary, letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginVertical: Spacing.xxs,
  },
  copyBtn: {
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
}); }
