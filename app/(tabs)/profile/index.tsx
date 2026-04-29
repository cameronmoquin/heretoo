/**
 * Profile — the user's launchpad.
 *
 * Replaces the bare avatar+sign-out screen with a proper hub:
 *   - Header: avatar + display name + handle + bio + edit
 *   - Network stats card (people / families)
 *   - Families list (tap to enter)
 *   - Quick actions (compose post, find family by code, theme toggle)
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
import { useAuth } from '../../../hooks/useAuth';
import {
  useMyFamilies, useMyNetworkStats,
  useMyStatures, useUpdateMyStature,
  STATURE_LABELS, type FamilyStature,
} from '../../../hooks/useFamily';
import { useThemeStore } from '../../../stores/themeStore';
import { showConfirm, showAlert } from '../../../lib/alert';
import { StatureAvatar } from '../../../components/shared/StatureAvatar';
import { ArtPreferences } from '../../../components/shared/ArtPreferences';
import { mediaPathToUrl } from '../../../hooks/useUpload';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius } from '../../../constants/design';

export default function OwnProfileScreen() {
  const s = makeStyles();
  const { profile, signOut } = useAuth();
  const { data: families } = useMyFamilies();
  const { data: stats } = useMyNetworkStats();
  const themeMode = useThemeStore((st) => st.mode);
  const toggleTheme = useThemeStore((st) => st.toggle);
  const { data: statures } = useMyStatures();
  const updateStature = useUpdateMyStature();
  const [picker, setPicker] = useState<{ familyId: string; familyName: string } | null>(null);

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
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => router.push('/(tabs)/profile/settings' as any)}
          >
            <Ionicons name="pencil" size={13} color={Colors.textPrimary} />
            <Text style={s.editBtnText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Network stats ── */}
        {stats && (
          <View style={s.statsCard}>
            <View style={s.statBlock}>
              <Text style={s.statValue}>{stats.reachable_profiles}</Text>
              <Text style={s.statLabel}>People in network</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBlock}>
              <Text style={s.statValue}>{stats.reachable_families}</Text>
              <Text style={s.statLabel}>Families connected</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBlock}>
              <Text style={s.statValue}>{stats.direct_family_count}</Text>
              <Text style={s.statLabel}>Your families</Text>
            </View>
          </View>
        )}

        {/* ── Families ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your families</Text>
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
                  <Text style={s.familyRoleSub}>Tap pill to change your role</Text>
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
              <Text style={s.emptyText}>You're not in a family yet.</Text>
              <View style={s.emptyBtnRow}>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={() => router.push('/family/new' as any)}
                >
                  <Text style={s.primaryBtnText}>Start a family</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, s.altBtn]}
                  onPress={() => router.push('/family/join' as any)}
                >
                  <Text style={[s.primaryBtnText, { color: Colors.primary }]}>Have a code</Text>
                </TouchableOpacity>
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
            sub="Direct chats with people in your network"
            onPress={() => router.push('/chat' as any)}
          />
          <ActionRow
            icon="add-circle-outline"
            label="Write a post"
            sub="Composer is also pinned to the top of your feed"
            onPress={() => router.push('/(tabs)/feed' as any)}
          />
          <ActionRow
            icon="key-outline"
            label="Join a family with a code"
            onPress={() => router.push('/family/join' as any)}
          />
          <ActionRow
            icon={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onPress={toggleTheme}
          />
        </View>

        {/* Gallery filter — collapsed by default; tap to set art prefs */}
        <ArtPreferences compact />

        {/* ── Sign out ── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={16} color={Colors.error} />
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

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
            <Text style={s.modalSub}>This sets the letter on your avatar.</Text>
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
  icon, label, sub, onPress,
}: { icon: any; label: string; sub?: string; onPress: () => void }) {
  const s = makeStyles();
  return (
    <TouchableOpacity style={s.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.actionIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actionLabel}>{label}</Text>
        {!!sub && <Text style={s.actionSub}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, gap: 18, paddingBottom: 100, maxWidth: 520, alignSelf: 'center', width: '100%' },

  identity: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  displayName: { fontWeight: '800', fontSize: 22, color: Colors.textPrimary, marginTop: 12 },
  handle: { fontSize: 14, color: Colors.textMuted },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 360 },
  editBtn: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight,
  },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 6,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: Colors.border },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 8,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionLink: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  familyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
  },
  familyIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  familyIconImg: { width: '100%', height: '100%' },
  familyName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  familyRole: { fontSize: 11, color: Colors.textMuted, marginTop: 1, textTransform: 'capitalize' },

  emptyFamilies: { alignItems: 'center', paddingVertical: 8, gap: 10 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  emptyBtnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  primaryBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
  altBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  actionIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  actionSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
  },
  signOutText: { fontSize: 13, color: Colors.error, fontWeight: '600' },

  familyRoleSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  rolePillText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    width: '100%', maxWidth: 420, padding: 18, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  modalSub: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  statureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
  },
  statureRowActive: { backgroundColor: Colors.primaryFaint },
  statureLabel: { fontSize: 15, color: Colors.textPrimary },
  statureLabelActive: { fontWeight: '700' },
  modalCancel: { alignItems: 'center', paddingVertical: 11, marginTop: 6 },
  modalCancelText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
}); }
