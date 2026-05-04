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
  useFamily, useFamilyMembers, useFamilyFeed, useFamilyUpdates, useLeaveFamily,
  useDeleteFamily, usePendingRename, useProposeRename, useVoteRename,
} from '../../../hooks/useFamily';
import { useToggleHeart } from '../../../hooks/useFeed';
import { useAuthStore } from '../../../stores/authStore';
import { goBackToFeed } from '../../../lib/nav';
import { showAlert, showConfirm } from '../../../lib/alert';
import { FeedComposer } from '../../../components/feed/FeedComposer';
import { PostCard } from '../../../components/feed/PostCard';
import { FamilyChatPanel } from '../../../components/family/FamilyChatPanel';
import { FamilyWallpaperVoting } from '../../../components/family/FamilyWallpaperVoting';
import { WallpaperBackground } from '../../../components/shared/WallpaperBackground';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

type Tab = 'feed' | 'chat' | 'about';

export default function FamilyDetail() {
  const s = makeStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [tab, setTab] = useState<Tab>('feed');
  const { data: family, isLoading } = useFamily(id);
  const { data: members } = useFamilyMembers(id);
  const { data: posts } = useFamilyFeed(id ?? null);
  const { data: updates } = useFamilyUpdates(id ?? null);
  const leave = useLeaveFamily();
  const deleteFamily = useDeleteFamily();
  const toggleHeart = useToggleHeart();
  const { data: pendingRename } = usePendingRename(id ?? null);
  const proposeRename = useProposeRename();
  const voteRename = useVoteRename();
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
        qc.invalidateQueries({ queryKey: ['family-updates', id] }),
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
          <Text style={{ color: Colors.textMuted }}>Family not found.</Text>
          <TouchableOpacity onPress={() => router.replace('/family')} style={[s.primaryBtn, { marginTop: 16 }]}>
            <Text style={s.primaryBtnText}>Back to families</Text>
          </TouchableOpacity>
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
      showAlert('Same name', "That's already this family's name.");
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
      'Delete this family?',
      "This is permanent — all posts and chat history go with it. Allowed only because you're the only member.",
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
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      {/* Family-scoped wallpaper — overrides the visitor's personal
          one with whatever the family has voted on. Falls back to the
          owner's personal wallpaper when no votes exist. Renders
          absolute below the page chrome. */}
      <WallpaperBackground familyId={id} />
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
        {(['feed', 'chat', 'about'] as Tab[]).map((t) => {
          const label =
            t === 'feed' ? 'Feed' :
            t === 'chat' ? 'Chat' :
            'About';
          return (
            <TouchableOpacity
              key={t}
              style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{label}</Text>
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
                  const shareText = `Join the ${family.name} family on HereToo: ${url}`;
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
            <FeedComposer familyId={id} />
            {(!posts || posts.length === 0) ? (
              <View style={s.emptyFeed}>
                <Ionicons name="chatbubble-outline" size={32} color={Colors.textMuted} />
                <Text style={s.emptyTitle}>Nothing here yet — be the first.</Text>
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

        {/* Updates tab removed — was redundant with the main feed.
            Posts will be tagged with a 'subject' (e.g., "Tim's
            health") in the next iteration so users can focus on a
            topic without juggling separate tabs. */}

        {tab === 'chat' && (
          <FamilyChatPanel familyId={id} />
        )}

        {tab === 'about' && (
          <>
            {/* Wallpaper voting — every active family member can pick.
                Plurality wins; ties break toward most recent vote.
                Default = the family owner's personal wallpaper. */}
            <FamilyWallpaperVoting familyId={id} />

            {/* Active rename proposal — shown to everyone in the family */}
            {pendingRename?.proposal && (
              <View style={s.proposalCard}>
                <Text style={s.sectionLabel}>Pending rename</Text>
                <Text style={s.proposalText}>
                  Someone proposed renaming this family to{'\n'}
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
                    <Ionicons name="checkmark" size={16} color={myVote?.vote === true ? '#000' : Colors.textPrimary} />
                    <Text style={[s.voteBtnText, myVote?.vote === true && { color: '#000' }]}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

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
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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

                  <TouchableOpacity
                    style={s.copyBtn}
                    onPress={async () => {
                      const code = (family as any).invite_code;
                      const origin =
                        typeof window !== 'undefined' && window.location?.origin
                          ? window.location.origin
                          : 'https://heretoo.social';
                      const url = `${origin}/join/${code}`;
                      const shareText = `Join the ${family.name} family on HereToo: ${url}`;
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
                    activeOpacity={0.75}
                  >
                    <Ionicons name="share-outline" size={14} color={Colors.primary} />
                    <Text style={s.copyBtnText}>Share invite link</Text>
                  </TouchableOpacity>
                </View>
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

            {/* Active-member actions: anyone can propose a rename */}
            {!pendingRename?.proposal && (
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => { setRenameDraft(family.name); setRenameOpen(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={16} color={Colors.textPrimary} />
                <Text style={s.secondaryBtnText}>Propose new name</Text>
              </TouchableOpacity>
            )}

            {!isOwner && (
              <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
                <Text style={s.leaveBtnText}>Leave family</Text>
              </TouchableOpacity>
            )}

            {/* Owner-only: delete only allowed when no other active members */}
            {isOwner && isSoloMember && (
              <TouchableOpacity style={s.deleteBtn} onPress={onDeleteFamily} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={15} color="#FFF" />
                <Text style={s.deleteBtnText}>Delete this family</Text>
              </TouchableOpacity>
            )}
            {isOwner && !isSoloMember && (
              <Text style={s.deleteHint}>
                Once another person joins, the family is theirs too — you can't delete it on your own.
              </Text>
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
            <Text style={s.modalSub}>
              {totalActive <= 1
                ? "You're the only active member, so this passes immediately."
                : `Other family members will vote — strictly more than half (${yesNeeded} of ${totalActive}) must agree.`}
            </Text>
            <TextInput
              style={s.modalInput}
              value={renameDraft}
              onChangeText={setRenameDraft}
              placeholder="New family name"
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

/**
 * UpdateCard — visually distinct from a regular PostCard:
 *   - Bold timestamp + "Update from <author>" header on top
 *   - Left-side accent strip in the primary color so the card reads
 *     as time-sensitive at a glance
 *   - Body in slightly larger type
 *   - Tappable to the post detail (where comments + reactions live)
 */
function UpdateCard({ post }: { post: any }) {
  const s = makeStyles();
  const author = post.author;
  const media: any[] = post.media ?? [];
  const dt = new Date(post.created_at);
  const dateLine = dt.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeLine = dt.toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <Pressable
      style={s.updateCard}
      onPress={() => router.push(`/(tabs)/feed/${post.id}` as any)}
    >
      <View style={s.updateAccent} />
      <View style={s.updateBody}>
        <View style={s.updateHeader}>
          <Text style={s.updateDate}>{dateLine} · {timeLine}</Text>
          <Text style={s.updateFrom}>
            from <Text style={{ fontWeight: '700' }}>
              {author?.display_name ?? author?.handle ?? 'someone'}
            </Text>
          </Text>
        </View>
        {!!post.body && <Text style={s.updateText}>{post.body}</Text>}
        {media.length > 0 && (
          <View style={s.updateMedia}>
            {/* Just a static thumb here — full media renders on detail */}
            <Ionicons name="image-outline" size={14} color={Colors.textMuted} />
            <Text style={s.updateMediaHint}>
              {media.length} attachment{media.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  name: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  metaText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  newPostBtn: {
    width: 36, height: 36, borderRadius: 7, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 4, paddingVertical: 4, marginRight: 4,
  },
  backBtnText: {
    fontSize: 14, color: Colors.textPrimary, fontWeight: '600',
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
  feedInviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
    alignSelf: 'flex-start',
    marginTop: 6, marginBottom: 4,
  },
  feedInviteText: { fontSize: 13, fontWeight: '600', color: Colors.primary, flexShrink: 1 },
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
    width: 28, height: 28, borderRadius: 6, backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberText: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  memberRole: { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },
  leaveBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 },
  leaveBtnText: { color: Colors.error, fontSize: 14, fontWeight: '500' },

  emptySub: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center',
    maxWidth: 320, marginTop: 6, lineHeight: 19,
  },

  // Update card — emphatic, time-sensitive
  updateCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
    marginVertical: 4,
  },
  updateAccent: { width: 4, backgroundColor: Colors.primary },
  updateBody: { flex: 1, padding: 14, gap: 6 },
  updateHeader: { gap: 2 },
  updateDate: {
    fontSize: 12, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  updateFrom: { fontSize: 12, color: Colors.textMuted },
  updateText: { fontSize: 16, color: Colors.textPrimary, lineHeight: 23, marginTop: 4 },
  updateMedia: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
  },
  updateMediaHint: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  // Rename proposal banner
  proposalCard: {
    backgroundColor: Colors.primaryFaint,
    borderColor: Colors.primary, borderWidth: 1,
    borderRadius: Radius.md,
    padding: 14, gap: 8,
  },
  proposalText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 19 },
  proposalTally: { fontSize: 12, color: Colors.textMuted },
  voteRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  voteBtnText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  voteBtnYesActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  voteBtnNoActive: { backgroundColor: Colors.error, borderColor: Colors.error },

  // Rename + delete buttons in About footer
  secondaryBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginTop: 8,
  },
  secondaryBtnText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  deleteBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    backgroundColor: Colors.error,
    marginTop: 8,
  },
  deleteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  deleteHint: {
    textAlign: 'center', fontSize: 11, color: Colors.textMuted,
    marginTop: 8, paddingHorizontal: 24, lineHeight: 16,
  },

  // Rename proposal modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 420, padding: 18, gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  modalSub: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  modalInput: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
    marginTop: 4,
  },
  modalRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  modalBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 999,
    alignItems: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: Colors.border },
  modalBtnGhostText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: Colors.primary },
  modalBtnPrimaryText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  postCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: {
    width: 36, height: 36, borderRadius: 7,
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
