import React from 'react';
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
import { useAuthStore } from '../../../../../stores/authStore';
import { showConfirm } from '../../../../../lib/alert';
import { CandonColors } from '../../../../../constants/candon-theme';

export default function PostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: post, isLoading } = useFamilyPost(postId ?? null);
  const { data: rsvps } = useEventRsvps(post?.event?.id ?? null);
  const setRsvp = useSetRsvp();
  const claim = useClaimAssignment();
  const unclaim = useUnclaimAssignment();
  const deletePost = useDeleteFamilyPost();

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

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Title */}
        <Text style={s.title}>{post.title}</Text>

        {/* Body */}
        {post.body && <Text style={s.body}>{post.body}</Text>}

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
});
