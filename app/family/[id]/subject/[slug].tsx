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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useSubjectBySlug, useFollowSubject, useUnfollowSubject, useRetireSubject,
} from '../../../../hooks/useSubjects';
import { useAuthStore } from '../../../../stores/authStore';
import { useSubjectsSeenStore } from '../../../../stores/subjectsSeenStore';
import { useToggleHeart } from '../../../../hooks/useFeed';
import { PostCard } from '../../../../components/feed/PostCard';
import { showAlert, showConfirm } from '../../../../lib/alert';
import { Eyebrow } from '../../../../components/shared/Eyebrow';
import { ScreenHeader } from '../../../../components/shared/ScreenHeader';
import { Colors } from '../../../../constants/colors';
import { Spacing, Radius, Type, FontFamily } from '../../../../constants/design';
import { Vocab } from '../../../../constants/vocab';

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
        <ScreenHeader showBack />
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
      `The subject will be marked closed and read-only. ${Vocab.PostPlural} and history stay; nothing is deleted.`,
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
      <ScreenHeader
        showBack
        right={
          <>
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
          </>
        }
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Title + description (the "wall plaque") */}
        <View style={s.plaque}>
          <Eyebrow>{isRetired ? 'Retired subject' : 'Subject'}</Eyebrow>
          <Text style={s.title}>{subject.name}</Text>
          {!!subject.description && (
            <Text style={s.description}>{subject.description}</Text>
          )}
          <Text style={s.meta}>
            {posts.length} {posts.length === 1 ? Vocab.post : Vocab.postPlural}
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
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },

  plaque: {
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: FontFamily } as any) : {}),
  },
  description: {
    fontSize: 15, lineHeight: 22, color: Colors.textSecondary,
  },
  meta: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: Spacing.xxs,
  },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: Spacing.sm, paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  followBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  followBtnText: {
    fontSize: Type.caption.size, fontWeight: '600', color: Colors.textSecondary,
  },
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
  emptyTitle: {
    fontSize: Type.ui.size, fontWeight: '700', color: Colors.textPrimary,
  },
}); }
