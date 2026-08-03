/**
 * Profile — the user's launchpad.
 *
 * Replaces the bare avatar+sign-out screen with a proper hub:
 *   - Header: avatar + display name + handle + bio + edit
 *   - Network stats card (people / crews)
 *   - Crews list (tap to enter)
 *   - Quick actions (compose post, find crew by code, theme toggle)
 *   - Settings & sign-out at the bottom
 *
 * Mobile: this is now the centerpiece of the bottom nav. Desktop: same
 * page, just framed by the sidebar.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import {
  useMyFamilies, useMyNetworkStats,
  useMyStatures, useUpdateMyStature,
  STATURE_LABELS, type FamilyStature,
} from '../../../hooks/useFamily';
import { useToggleHeart } from '../../../hooks/useFeed';
import { PostCard } from '../../../components/feed/PostCard';
import { showConfirm, showAlert } from '../../../lib/alert';
import { StatureAvatar } from '../../../components/shared/StatureAvatar';
import { ArtPreferences } from '../../../components/shared/ArtPreferences';
import { WCRBPlayer } from '../../../components/shared/WCRBPlayer';
import { PlantTreeModal } from '../../../components/shared/PlantTreeModal';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { Button } from '../../../components/shared/Button';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { Vocab } from '../../../constants/vocab';

export default function OwnProfileScreen() {
  const s = makeStyles();
  const { profile, signOut } = useAuth();
  const { data: families } = useMyFamilies();
  const { data: stats } = useMyNetworkStats();
  const { data: statures } = useMyStatures();
  const updateStature = useUpdateMyStature();
  const [picker, setPicker] = useState<{ familyId: string; familyName: string } | null>(null);
  const [plantOpen, setPlantOpen] = useState(false);
  const toggleHeart = useToggleHeart();

  // Your own public posts — shown at the bottom of the profile hub.
  // Same RLS-respecting query the /u/[handle] page uses; here we
  // filter to visibility='public' specifically so the page reads as
  // "your contribution to the common feed" rather than mixing in
  // crew-only material.
  const { data: myPublicPosts } = useQuery({
    queryKey: ['profile-posts', profile?.id, 'public'],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('posts')
        .select(
          '*, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)',
        )
        .eq('author_id', profile.id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const handleSignOut = () => showConfirm('Sign out', 'Are you sure?', signOut, 'Sign out');

  if (!profile) return null;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* ── Identity ── */}
        <View style={s.identity}>
          <StatureAvatar
            profileId={profile.id}
            name={profile.display_name}
            photoUrl={profile.avatar_path ? mediaPathToUrl(profile.avatar_path) : null}
            size={84}
          />
          <Text style={s.displayName}>{profile.display_name ?? 'Member'}</Text>
          <Text style={s.handle}>@{profile.handle}</Text>
          {!!profile.bio && <Text style={s.bio}>{profile.bio}</Text>}
          <Button
            title="Edit profile"
            variant="secondary"
            size="sm"
            icon={<Ionicons name="pencil" size={13} color={Colors.textPrimary} />}
            style={s.editBtn}
            onPress={() => router.push('/(tabs)/profile/settings' as any)}
          />
        </View>

        {/* ── Network stats ── */}
        {stats && (
          <View style={s.statsCard}>
            {/* "People in network" is now tappable — opens the
                network list page where you can see everyone and
                jump to their profile or message them. */}
            <TouchableOpacity
              style={s.statBlock}
              onPress={() => router.push('/network' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.statValue}>{stats.reachable_profiles}</Text>
              <Text style={s.statLabel}>People in network</Text>
            </TouchableOpacity>
            <View style={s.statDivider} />
            <View style={s.statBlock}>
              <Text style={s.statValue}>{stats.reachable_families}</Text>
              <Text style={s.statLabel}>Crews connected</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBlock}>
              <Text style={s.statValue}>{stats.direct_family_count}</Text>
              <Text style={s.statLabel}>Your crews</Text>
            </View>
          </View>
        )}

        {/* ── Crews ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your crews</Text>
            <TouchableOpacity onPress={() => router.push('/family' as any)}>
              <Text style={s.sectionLink}>See all →</Text>
            </TouchableOpacity>
          </View>
          {(families ?? []).slice(0, 4).map((f: any) => {
            const myStature = (statures?.[f.id] ?? null) as FamilyStature | null;
            const myRoleLabel = myStature ? STATURE_LABELS[myStature] : 'Set role';
            return (
              <View key={f.id} style={s.familyRow}>
                <TouchableOpacity
                  style={s.familyIcon}
                  onPress={() => router.push(`/family/${f.id}` as any)}
                  activeOpacity={0.7}
                >
                  {f.cover_path ? (
                    <Image source={{ uri: mediaPathToUrl(f.cover_path) }} style={s.familyIconImg} />
                  ) : (
                    <Ionicons name="people" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/family/${f.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={s.familyName}>{f.name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.rolePill}
                  onPress={() => setPicker({ familyId: f.id, familyName: f.name })}
                  activeOpacity={0.7}
                >
                  <Text style={[s.rolePillText, !myStature && { color: Colors.textMuted }]}>
                    {myRoleLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
          {(!families || families.length === 0) && (
            <View style={s.emptyFamilies}>
              <Text style={s.emptyText}>You're not in a crew yet.</Text>
              <View style={s.emptyBtnRow}>
                <Button
                  title="Start a crew"
                  size="sm"
                  style={s.primaryBtn}
                  onPress={() => router.push('/family/new' as any)}
                />
                <Button
                  title="Have a code"
                  variant="ghost"
                  size="sm"
                  style={s.altBtn}
                  onPress={() => router.push('/family/join' as any)}
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Quick actions ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick actions</Text>
          <ActionRow
            icon="chatbubbles-outline"
            label="Messages"
            onPress={() => router.push('/messages')}
          />
          <ActionRow
            icon="add-circle-outline"
            label={`Write a ${Vocab.post}`}
            onPress={() => router.push('/(tabs)/feed' as any)}
          />
          <ActionRow
            icon="notifications-outline"
            label="Notifications & email"
            onPress={() => router.push('/(tabs)/profile/notifications' as any)}
          />
          <ActionRow
            icon="key-outline"
            label="Join a crew with a code"
            onPress={() => router.push('/family/join' as any)}
          />
          <ActionRow
            icon="leaf-outline"
            label="Plant a tree with a friend"
            onPress={() => setPlantOpen(true)}
          />
          {/* Dark theme toggle removed for now — light-only while we
              dial in the polish pass. */}
        </View>

        {/* Gallery filter + wallpaper picker + classical music stream.
            These three components together render the user's "style"
            choices — wallpaper, radio, and gallery filter — which
            are also part of how their profile reads to others when
            we sync the picks to the DB (future: profile_prefs sync). */}
        <ArtPreferences compact />
        <WCRBPlayer compact />

        {/* ── Your common-area posts ── */}
        {myPublicPosts && myPublicPosts.length > 0 && (
          <View style={[s.section, { marginTop: 8 }]}>
            <Text style={s.sectionTitle}>Your {Vocab.postPlural}</Text>
            {myPublicPosts.map((p: any) => (
              <PostCard
                key={p.id}
                post={p}
                onHeart={(id) => toggleHeart.mutate(id)}
              />
            ))}
          </View>
        )}

        {/* ── Sign out ── */}
        <Button
          title="Sign out"
          variant="outline"
          icon={<Ionicons name="log-out-outline" size={16} color={Colors.error} />}
          style={s.signOutBtn}
          textStyle={s.signOutText}
          onPress={handleSignOut}
        />
      </ScrollView>

      {/* Plant-a-tree (founding seed invite) modal */}
      <PlantTreeModal visible={plantOpen} onClose={() => setPlantOpen(false)} />

      {/* Stature picker modal */}
      <Modal
        visible={!!picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Your role in {picker?.familyName}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {(Object.keys(STATURE_LABELS) as FamilyStature[]).map((key) => {
                const isCurrent = picker && statures?.[picker.familyId] === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.statureRow, isCurrent && s.statureRowActive]}
                    onPress={() => {
                      if (!picker) return;
                      updateStature.mutate(
                        { familyId: picker.familyId, stature: key },
                        {
                          onSuccess: () => setPicker(null),
                          onError: (e: any) => showAlert('Could not update', e?.message ?? 'Try again.'),
                        },
                      );
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.statureLabel, isCurrent && s.statureLabelActive]}>
                      {STATURE_LABELS[key]}
                    </Text>
                    {isCurrent && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.modalCancel} onPress={() => setPicker(null)}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ActionRow({
  icon, label, onPress,
}: { icon: any; label: string; onPress: () => void }) {
  const s = makeStyles();
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.actionIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actionLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.md, gap: 18, paddingBottom: 100, maxWidth: 520, alignSelf: 'center', width: '100%' },

  identity: { alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  displayName: { fontWeight: '800', fontSize: 22, color: Colors.textPrimary, marginTop: Spacing.sm },
  handle: { fontSize: Type.ui.size, color: Colors.textMuted },
  bio: {
    fontSize: Type.ui.size, color: Colors.textSecondary, textAlign: 'center',
    marginTop: 6, lineHeight: 20, maxWidth: 360,
  },
  editBtn: {
    marginTop: 10, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 6,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: Spacing.xl, backgroundColor: Colors.border },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: Spacing.xs,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionLink: {
    fontSize: Type.caption.size, color: Colors.primary, fontWeight: '600',
  },

  familyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: Spacing.xs,
  },
  familyIcon: {
    width: 36, height: 36, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  familyIconImg: { width: '100%', height: '100%' },
  familyName: {
    fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary,
  },
  familyRole: {
    fontSize: Type.eyebrow.size, color: Colors.textMuted, marginTop: 1, textTransform: 'capitalize',
  },

  emptyFamilies: { alignItems: 'center', paddingVertical: Spacing.xs, gap: 10 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  emptyBtnRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  primaryBtn: { borderRadius: Radius.full },
  altBtn: {
    borderRadius: Radius.full,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary,
  },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  actionIcon: {
    width: Spacing.xl, height: Spacing.xl, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary,
  },

  signOutBtn: {
    borderRadius: Radius.full,
    borderColor: Colors.border,
  },
  signOutText: { fontSize: 13, color: Colors.error, fontWeight: '600' },

  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  rolePillText: {
    fontSize: Type.caption.size, fontWeight: '600', color: Colors.textPrimary,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.control,
    width: '100%', maxWidth: 420, padding: 18, gap: Spacing.xxs,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: Type.bodyBold.size, fontWeight: Type.bodyBold.weight,
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  statureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm,
  },
  statureRowActive: { backgroundColor: Colors.primaryFaint },
  statureLabel: { fontSize: 15, color: Colors.textPrimary },
  statureLabelActive: { fontWeight: '700' },
  modalCancel: { alignItems: 'center', paddingVertical: 11, marginTop: 6 },
  modalCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
