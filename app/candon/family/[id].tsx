import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyGroup, useFamilyMembers, useLeaveFamilyGroup } from '../../../hooks/useFamilyGroups';
import { useAuthStore } from '../../../stores/authStore';
import { showAlert, showConfirm } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';

export default function FamilyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: group, isLoading } = useFamilyGroup(id);
  const { data: members } = useFamilyMembers(id);
  const leave = useLeaveFamilyGroup();

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!group) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  const isOwner = group.owner_user_id === userId;

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
        leave.mutate(group.id, {
          onSuccess: () => router.back(),
        });
      },
      isOwner ? 'OK' : 'Leave',
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.iconBox}>
          <Ionicons name="home" size={28} color={CandonColors.primary} />
        </View>
        <Text style={s.name}>{group.name}</Text>
        {!!group.description && <Text style={s.description}>{group.description}</Text>}

        {/* Invite code */}
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

        {/* Members */}
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

        {/* Phase 2 placeholder */}
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>
            Posts, events, and bulletins arrive in Phase 2.
          </Text>
        </View>

        {!isOwner && (
          <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
            <Text style={s.leaveBtnText}>Leave group</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 14, alignItems: 'center', maxWidth: 600, alignSelf: 'center', width: '100%' },
  empty: { padding: 40, textAlign: 'center', color: CandonColors.textMuted },
  iconBox: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  name: { fontSize: 20, fontWeight: '600', color: CandonColors.textPrimary },
  description: { fontSize: 14, color: CandonColors.textSecondary, textAlign: 'center', marginTop: -6 },
  card: {
    width: '100%', backgroundColor: CandonColors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, gap: 8,
  },
  inviteCard: {
    width: '100%', backgroundColor: CandonColors.primaryFaint, borderRadius: 12, padding: 16,
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
  placeholder: {
    width: '100%', padding: 14, borderRadius: 10, marginTop: 4,
    backgroundColor: CandonColors.surfaceRaise,
    borderWidth: 1, borderColor: CandonColors.borderLight,
  },
  placeholderText: { fontSize: 13, color: CandonColors.textMuted, textAlign: 'center' },
  leaveBtn: { paddingVertical: 10, paddingHorizontal: 14, marginTop: 8 },
  leaveBtnText: { color: CandonColors.error, fontSize: 14, fontWeight: '500' },
});
