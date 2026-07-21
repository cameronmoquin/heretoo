/**
 * SubjectsPanel — the crew page's Subjects tab.
 *
 * Lists open subjects first (with post counts and a follow toggle),
 * then a retired section below. A "Start a subject" composer at the
 * top opens a one-line input. No descriptions, no covers — those come
 * later from the Subject page itself.
 *
 * Source of Truth, Milestone 3. Refusal list:
 *   - No suggestions. The user finds Subjects by being in the crew.
 *   - No global hashtag index. These are crew-scoped only.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useFamilySubjects, useCreateSubject,
  useFollowSubject, useUnfollowSubject, useSubjectsNewActivity,
  type SubjectWithCount,
} from '../../hooks/useSubjects';
import { useSubjectsSeenStore } from '../../stores/subjectsSeenStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  familyId: string;
}

export function SubjectsPanel({ familyId }: Props) {
  const s = makeStyles();
  const { data: subjects, isLoading } = useFamilySubjects(familyId);
  const createSubject = useCreateSubject();
  const [draft, setDraft] = useState('');

  // New-activity state for followed subjects (one realtime subscription
  // lives in this hook — call it once here, not per row).
  const activity = useSubjectsNewActivity(familyId);

  const open = (subjects ?? []).filter((x) => !x.retired_at);
  const retired = (subjects ?? []).filter((x) => !!x.retired_at);

  const onCreate = async () => {
    const name = draft.trim();
    if (name.length < 2) return;
    try {
      const created = await createSubject.mutateAsync({ familyId, name });
      setDraft('');
      router.push(`/family/${familyId}/subject/${created.slug}` as any);
    } catch (e: any) {
      showAlert('Could not create subject', e?.message ?? 'Try again.');
    }
  };

  return (
    <View style={s.wrap}>
      {/* Compose a new subject */}
      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Subject"
          placeholderTextColor={Colors.textMuted}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={onCreate}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[s.composerBtn, (draft.trim().length < 2 || createSubject.isPending) && { opacity: 0.4 }]}
          onPress={onCreate}
          disabled={draft.trim().length < 2 || createSubject.isPending}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Open subjects */}
      {isLoading && (
        <Text style={s.emptyText}>…</Text>
      )}

      {!isLoading && open.length === 0 && retired.length === 0 && (
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>No subjects yet.</Text>
        </View>
      )}

      {open.length > 0 && open.map((subj) => (
        <SubjectRow
          key={subj.id}
          familyId={familyId}
          subject={subj}
          isNew={activity.isNew(subj.id)}
          latestAt={activity.latestFor(subj.id)}
        />
      ))}

      {retired.length > 0 && (
        <>
          <View style={s.divider} />
          <Text style={s.retiredHeader}>Retired</Text>
          {retired.map((subj) => (
            <SubjectRow
              key={subj.id}
              familyId={familyId}
              subject={subj}
              isNew={activity.isNew(subj.id)}
              latestAt={activity.latestFor(subj.id)}
            />
          ))}
        </>
      )}
    </View>
  );
}

function SubjectRow({
  familyId, subject, isNew, latestAt,
}: {
  familyId: string;
  subject: SubjectWithCount;
  isNew?: boolean;
  latestAt?: string;
}) {
  const s = makeStyles();
  const follow = useFollowSubject();
  const unfollow = useUnfollowSubject();
  const markSeen = useSubjectsSeenStore((st) => st.markSeen);
  const isRetired = !!subject.retired_at;

  const onToggleFollow = (e: any) => {
    e.stopPropagation?.();
    if (subject.is_following) unfollow.mutate(subject.id);
    else follow.mutate(subject.id);
  };

  const onOpen = () => {
    // Opening the subject is "I've seen it" — clear the new-activity dot.
    markSeen(subject.id, latestAt ?? new Date().toISOString());
    router.push(`/family/${familyId}/subject/${subject.slug}` as any);
  };

  return (
    <TouchableOpacity
      style={[s.row, isRetired && { opacity: 0.6 }]}
      onPress={onOpen}
      activeOpacity={0.7}
    >
      <View style={[s.rowDot, isNew && s.rowDotNew]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.rowNameLine}>
          <Text style={s.rowName} numberOfLines={1}>{subject.name}</Text>
          {isNew && (
            <View style={s.newPill}>
              <Text style={s.newPillText}>New</Text>
            </View>
          )}
        </View>
        <Text style={s.rowMeta}>
          {subject.post_count} {subject.post_count === 1 ? 'post' : 'posts'}
          {isRetired ? ' · retired' : ''}
        </Text>
      </View>
      {!isRetired && (
        <TouchableOpacity
          style={[s.followBtn, subject.is_following && s.followBtnOn]}
          onPress={onToggleFollow}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.75}
        >
          <Ionicons
            name={subject.is_following ? 'checkmark' : 'add'}
            size={14}
            color={subject.is_following ? Colors.primary : Colors.textSecondary}
          />
          <Text style={[s.followBtnText, subject.is_following && { color: Colors.primary }]}>
            {subject.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { gap: 6 },

  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: Spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
  },
  composerBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyWrap: { padding: Spacing.lg, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { color: Colors.textMuted, padding: Spacing.lg },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    marginBottom: 6,
  },
  rowDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary, opacity: 0.75,
  },
  rowDotNew: {
    width: 10, height: 10, borderRadius: 5, opacity: 1,
  },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, flexShrink: 1 },
  newPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  newPillText: {
    fontSize: 10, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  rowMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  followBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  followBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  retiredHeader: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginBottom: 6,
  },
}); }
