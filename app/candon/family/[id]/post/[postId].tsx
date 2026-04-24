import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useFamilyPost, useEventRsvps, useSetRsvp,
  useClaimAssignment, useUnclaimAssignment,
  useDeleteFamilyPost,
  type RsvpResponse,
} from '../../../../../hooks/useFamilyPosts';
import {
  useMedicalUpdate, usePostAcks, useAcknowledgePost,
  usePostViewLog, logPostView, type MedicalStatus,
} from '../../../../../hooks/useMedicalUpdates';
import { useAuthStore } from '../../../../../stores/authStore';
import { showConfirm } from '../../../../../lib/alert';
import { CandonColors } from '../../../../../constants/candon-theme';

const MEDICAL_STATUS_LABELS: Record<MedicalStatus, { label: string; color: string }> = {
  stable: { label: 'Stable', color: CandonColors.primary },
  monitoring: { label: 'Monitoring', color: CandonColors.warm },
  improving: { label: 'Improving', color: CandonColors.primary },
  recovering: { label: 'Recovering', color: CandonColors.primary },
  concerning: { label: 'Concerning', color: CandonColors.warning },
  critical: { label: 'Critical', color: CandonColors.error },
  passed: { label: 'Passed', color: CandonColors.textMuted },
};

const SCOPE_LABELS: Record<string, { label: string; icon: any }> = {
  group: { label: 'Everyone in group', icon: 'people-outline' },
  selected_members: { label: 'Selected people', icon: 'person-outline' },
  admins_only: { label: 'Admins only', icon: 'shield-outline' },
  medical_limited: { label: 'Medical circle', icon: 'medkit-outline' },
};

export default function PostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: post, isLoading } = useFamilyPost(postId ?? null);
  const { data: rsvps } = useEventRsvps(post?.event?.id ?? null);
  const { data: medical } = useMedicalUpdate(
    post?.post_type === 'medical_update' ? (postId ?? null) : null,
  );
  const { data: acks } = usePostAcks(
    post?.sensitivity === 'medical' || post?.sensitivity === 'private' ? (postId ?? null) : null,
  );
  const { data: viewLog } = usePostViewLog(
    post?.created_by === userId && (post?.sensitivity === 'medical') ? (postId ?? null) : null,
  );
  const acknowledgePost = useAcknowledgePost();
  const setRsvp = useSetRsvp();
  const claim = useClaimAssignment();
  const unclaim = useUnclaimAssignment();
  const deletePost = useDeleteFamilyPost();

  // Log view on mount for sensitive posts
  useEffect(() => {
    if (post && post.sensitivity !== 'normal' && userId) {
      logPostView(post.id, userId);
    }
  }, [post?.id, post?.sensitivity, userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
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

  const myRsvp = rsvps?.find((r) => r.user_id === userId)?.response;
  const yesCount = rsvps?.filter((r) => r.response === 'yes').length ?? 0;
  const noCount = rsvps?.filter((r) => r.response === 'no').length ?? 0;
  const maybeCount = rsvps?.filter((r) => r.response === 'maybe').length ?? 0;
  const isAuthor = post.created_by === userId;

  const handleRsvp = (response: RsvpResponse) => {
    if (!post.event) return;
    setRsvp.mutate({ eventId: post.event.id, response });
  };

  const handleDelete = () => {
    showConfirm(
      'Delete this post?',
      'Everyone in the group will lose access to it.',
      () => {
        deletePost.mutate(post.id, { onSuccess: () => router.back() });
      },
      'Delete',
    );
  };

  // Compute visibility + medical data
  const scopeInfo = SCOPE_LABELS[post.visibility_scope] ?? SCOPE_LABELS.group;
  const myAck = acks?.find((a) => a.user_id === userId);
  const ackCount = acks?.length ?? 0;
  const needsAck = post.sensitivity === 'medical' && !myAck;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Visibility badge — always shown for non-group scope */}
        {post.visibility_scope !== 'group' && (
          <View style={s.scopeBadge}>
            <Ionicons name={scopeInfo.icon} size={12} color={CandonColors.primary} />
            <Text style={s.scopeBadgeText}>{scopeInfo.label}</Text>
          </View>
        )}

        {/* Medical status banner */}
        {medical && (
          <View
            style={[
              s.medicalBanner,
              { borderLeftColor: MEDICAL_STATUS_LABELS[medical.status_level].color },
            ]}
          >
            <View style={s.medicalHeader}>
              <Ionicons name="medkit-outline" size={14} color={CandonColors.medical} />
              <Text style={s.medicalLabel}>{medical.patient_label}</Text>
              <View
                style={[
                  s.statusPill,
                  { backgroundColor: MEDICAL_STATUS_LABELS[medical.status_level].color + '20' },
                ]}
              >
                <Text
                  style={[
                    s.statusPillText,
                    { color: MEDICAL_STATUS_LABELS[medical.status_level].color },
                  ]}
                >
                  {MEDICAL_STATUS_LABELS[medical.status_level].label}
                </Text>
              </View>
            </View>
            {medical.care_location && (
              <Text style={s.medicalFact}>
                <Text style={s.medicalFactLabel}>Where: </Text>{medical.care_location}
              </Text>
            )}
            {medical.contact_person && (
              <Text style={s.medicalFact}>
                <Text style={s.medicalFactLabel}>Contact: </Text>{medical.contact_person}
              </Text>
            )}
            {medical.help_needed && (
              <Text style={s.medicalFact}>
                <Text style={s.medicalFactLabel}>How to help: </Text>{medical.help_needed}
              </Text>
            )}
          </View>
        )}

        {/* Title */}
        <Text style={s.title}>{post.title}</Text>

        {/* Body */}
        {post.body && <Text style={s.body}>{post.body}</Text>}

        {/* Acknowledgement CTA for medical posts */}
        {needsAck && (
          <TouchableOpacity
            style={s.ackBtn}
            onPress={() => acknowledgePost.mutate(post.id)}
            disabled={acknowledgePost.isPending}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={CandonColors.primary} />
            <Text style={s.ackBtnText}>I've seen this</Text>
          </TouchableOpacity>
        )}
        {myAck && post.sensitivity === 'medical' && (
          <Text style={s.ackNote}>
            You acknowledged this {new Date(myAck.acknowledged_at).toLocaleDateString()}
          </Text>
        )}

        {/* Author-only: ack count for medical posts */}
        {post.created_by === userId && post.sensitivity === 'medical' && (
          <Text style={s.ackCount}>{ackCount} acknowledgement{ackCount === 1 ? '' : 's'}</Text>
        )}

        {/* Event info */}
        {post.event && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="calendar-outline" size={18} color={CandonColors.primary} />
              <Text style={s.cardRowText}>
                {new Date(post.event.start_at).toLocaleString([], {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </Text>
            </View>
            {post.event.location_name && (
              <View style={s.cardRow}>
                <Ionicons name="location-outline" size={18} color={CandonColors.primary} />
                <View>
                  <Text style={s.cardRowText}>{post.event.location_name}</Text>
                  {post.event.location_address && (
                    <Text style={s.cardRowSub}>{post.event.location_address}</Text>
                  )}
                </View>
              </View>
            )}

            {/* RSVP buttons */}
            <View style={s.rsvpBar}>
              {(['yes', 'maybe', 'no'] as RsvpResponse[]).map((r) => {
                const active = myRsvp === r;
                const label = r === 'yes' ? 'Going' : r === 'no' ? "Can't" : 'Maybe';
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.rsvpBtn, active && s.rsvpBtnActive]}
                    onPress={() => handleRsvp(r)}
                  >
                    <Text style={[s.rsvpBtnText, active && s.rsvpBtnTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.rsvpCount}>
              {yesCount} going · {maybeCount} maybe · {noCount} no
            </Text>
          </View>
        )}

        {/* Assignments (bring list / sign-ups) */}
        {post.assignments && post.assignments.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Sign up</Text>
            {post.assignments.map((a) => {
              const claimedByMe = a.claimed_by_user_id === userId;
              return (
                <View key={a.id} style={s.assignmentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.assignmentLabel, a.claimed_by_user_id && s.assignmentLabelClaimed]}>
                      {a.label}
                    </Text>
                    {a.claimed_by_user_id && (
                      <Text style={s.assignmentClaimedBy}>
                        {claimedByMe ? 'You' : 'Someone'}
                      </Text>
                    )}
                  </View>
                  {a.claimed_by_user_id ? (
                    claimedByMe ? (
                      <TouchableOpacity
                        style={[s.claimBtn, s.claimBtnActive]}
                        onPress={() => unclaim.mutate(a.id)}
                      >
                        <Text style={s.claimBtnTextActive}>Drop</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.claimBtn, { opacity: 0.4 }]}>
                        <Text style={s.claimBtnText}>Taken</Text>
                      </View>
                    )
                  ) : (
                    <TouchableOpacity style={s.claimBtn} onPress={() => claim.mutate(a.id)}>
                      <Text style={s.claimBtnText}>I'll bring it</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Author-only view audit log for medical posts */}
        {isAuthor && post.sensitivity === 'medical' && viewLog && viewLog.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Who opened this ({viewLog.length})</Text>
            {viewLog.slice(0, 10).map((v) => (
              <View key={v.id} style={s.viewRow}>
                <Text style={s.viewUser}>{v.user_id.slice(0, 8)}…</Text>
                <Text style={s.viewTime}>
                  {new Date(v.viewed_at).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {isAuthor && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={14} color={CandonColors.error} />
            <Text style={s.deleteText}>Delete post</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 14, maxWidth: 600, alignSelf: 'center', width: '100%' },
  empty: { padding: 40, textAlign: 'center', color: CandonColors.textMuted },
  title: { fontSize: 22, fontWeight: '700', color: CandonColors.textPrimary },
  body: { fontSize: 15, color: CandonColors.textPrimary, lineHeight: 22 },
  card: {
    backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, gap: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardRowText: { fontSize: 14, color: CandonColors.textPrimary, fontWeight: '500' },
  cardRowSub: { fontSize: 12, color: CandonColors.textMuted, marginTop: 2 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: CandonColors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  rsvpBar: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: 8, borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.bg,
  },
  rsvpBtnActive: { backgroundColor: CandonColors.primary, borderColor: CandonColors.primary },
  rsvpBtnText: { fontSize: 14, fontWeight: '600', color: CandonColors.textSecondary },
  rsvpBtnTextActive: { color: '#FFF' },
  rsvpCount: { fontSize: 12, color: CandonColors.textMuted, textAlign: 'center' },
  assignmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.borderLight,
  },
  assignmentLabel: { fontSize: 15, color: CandonColors.textPrimary, fontWeight: '500' },
  assignmentLabelClaimed: { color: CandonColors.textMuted },
  assignmentClaimedBy: { fontSize: 11, color: CandonColors.primary, marginTop: 2 },
  claimBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: CandonColors.primary,
  },
  claimBtnActive: { backgroundColor: CandonColors.primary },
  claimBtnText: { fontSize: 13, color: CandonColors.primary, fontWeight: '600' },
  claimBtnTextActive: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', padding: 10, marginTop: 8 },
  deleteText: { color: CandonColors.error, fontSize: 13, fontWeight: '500' },

  // Visibility scope badge
  scopeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
    backgroundColor: CandonColors.primaryFaint,
  },
  scopeBadgeText: {
    fontSize: 11, color: CandonColors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Medical banner
  medicalBanner: {
    backgroundColor: CandonColors.surface, borderRadius: 10, padding: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: CandonColors.border,
    gap: 6,
  },
  medicalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medicalLabel: {
    flex: 1, fontSize: 15, fontWeight: '600', color: CandonColors.textPrimary,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  medicalFact: { fontSize: 13, color: CandonColors.textPrimary, lineHeight: 18 },
  medicalFactLabel: { fontWeight: '600', color: CandonColors.textSecondary },

  // Ack
  ackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8,
    backgroundColor: CandonColors.primaryFaint, borderWidth: 1, borderColor: CandonColors.primary,
  },
  ackBtnText: { fontSize: 14, fontWeight: '600', color: CandonColors.primary },
  ackNote: {
    fontSize: 12, color: CandonColors.textMuted, textAlign: 'center', fontStyle: 'italic',
  },
  ackCount: { fontSize: 12, color: CandonColors.textMuted, textAlign: 'center' },

  // View log
  viewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: CandonColors.borderLight,
  },
  viewUser: { fontSize: 12, fontFamily: 'monospace', color: CandonColors.textPrimary },
  viewTime: { fontSize: 11, color: CandonColors.textMuted },
});
