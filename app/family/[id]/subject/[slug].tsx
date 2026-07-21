/**
 * Subject page — `/family/{id}/subject/{slug}`.
 *
 * Source of Truth, Milestone 3: "Cover image at top, title in Syne 800,
 * one-paragraph description, then a chronological list of posts tagged
 * with the Subject, oldest first. Reading top-to-bottom is reading the
 * story."
 *
 * Header has Back, Follow, and (creator-only) Retire actions.
 * No comments here directly — tap a post to open it.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useSubjectBySlug, useFollowSubject, useUnfollowSubject, useRetireSubject,
} from '../../../../hooks/useSubjects';
import { useAuthStore } from '../../../../stores/authStore';
import { useSubjectsSeenStore } from '../../../../stores/subjectsSeenStore';
import { useToggleHeart } from '../../../../hooks/useFeed';
import { PostCard } from '../../../../components/feed/PostCard';
import { showAlert, showConfirm } from '../../../../lib/alert';
import { Colors } from '../../../../constants/colors';
import { Spacing, Radius } from '../../../../constants/design';

export default function SubjectScreen() {
  const s = makeStyles();
  const { id: familyId, slug } = useLocalSearchParams<{ id: string; slug: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const { data, isLoading } = useSubjectBySlug(familyId ?? null, slug ?? null);
  const follow = useFollowSubject();
  const unfollow = useUnfollowSubject();
  const retire = useRetireSubject();
  const toggleHeart = useToggleHeart();
  const markSeen = useSubjectsSeenStore((st) => st.markSeen);
  const [retiring, setRetiring] = useState(false);

  // Opening the subject clears its "new activity" dot — you're reading
  // it now, so everything up to now counts as seen.
  const subjectId = data?.subject?.id;
  useEffect(() => {
    if (subjectId) markSeen(subjectId, new Date().toISOString());
  }, [subjectId, markSeen]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!data?.subject) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={s.empty}>Subject not found.</Text>
      </SafeAreaView>
    );
  }

  const { subject, posts, isFollowing } = data;
  const isCreator = !!userId && subject.created_by === userId;
  const isRetired = !!subject.retired_at;

  const onToggleFollow = () => {
    if (isFollowing) unfollow.mutate(subject.id);
    else follow.mutate(subject.id);
  };

  const onRetire = () => {
    showConfirm(
      `Retire "${subject.name}"?`,
      'The subject will be marked closed and read-only. Posts and history stay; nothing is deleted.',
      async () => {
        setRetiring(true);
        try {
          await retire.mutateAsync({ subjectId: subject.id });
        } catch (e: any) {
          showAlert('Could not retire', e?.message ?? 'Try again.');
        } finally {
          setRetiring(false);
        }
      },
      'Retire', 'Cancel',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {!isRetired && (
          <TouchableOpacity
            style={[s.followBtn, isFollowing && s.followBtnOn]}
            onPress={onToggleFollow}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isFollowing ? 'checkmark' : 'add'}
              size={14}
              color={isFollowing ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[s.followBtnText, isFollowing && { color: Colors.primary }]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
        {isCreator && !isRetired && (
          <TouchableOpacity
            style={s.retireBtn}
            onPress={onRetire}
            disabled={retiring}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="archive-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Title + description (the "wall plaque") */}
        <View style={s.plaque}>
          <Text style={s.kicker}>{isRetired ? 'Retired subject' : 'Subject'}</Text>
          <Text style={s.title}>{subject.name}</Text>
          {!!subject.description && (
            <Text style={s.description}>{subject.description}</Text>
          )}
          <Text style={s.meta}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>

        {/* The story, oldest first */}
        {posts.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Nothing tagged with this subject yet.</Text>
          </View>
        ) : (
          posts.map((p: any) => (
            <PostCard key={p.id} post={p} onHeart={(pid) => toggleHeart.mutate(pid)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: {
    flex: 1, backgroundColor: 'transparent',
    maxWidth: 720, alignSelf: 'center', width: '100%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    height: 52,
  },
  backBtn: { padding: 4 },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },

  plaque: {
    paddingVertical: Spacing.lg,
    gap: 8,
  },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  description: {
    fontSize: 15, lineHeight: 22, color: Colors.textSecondary,
  },
  meta: {
    fontSize: 12, color: Colors.textMuted, marginTop: 4,
  },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  followBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  followBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  retireBtn: {
    width: 36, height: 36, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },
  emptyWrap: {
    padding: Spacing.lg, gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
}); }
