import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CandonColors } from '../../constants/candon-theme';
import { useFamilyMembers } from '../../hooks/useFamilyGroups';
import { useAuthStore } from '../../stores/authStore';
import type { VisibilityScope } from '../../hooks/useFamilyPosts';

interface Props {
  groupId: string;
  scope: VisibilityScope;
  recipientIds: string[];
  onScopeChange: (s: VisibilityScope) => void;
  onRecipientsChange: (ids: string[]) => void;
  // Medical mode forces medical_limited and hides 'group' from the options.
  medicalMode?: boolean;
}

const SCOPES: { id: VisibilityScope; label: string; description: string; icon: any }[] = [
  { id: 'group', label: 'Everyone in group', description: 'All members see it', icon: 'people-outline' },
  { id: 'selected_members', label: 'Selected people', description: 'Only people you pick', icon: 'person-outline' },
  { id: 'admins_only', label: 'Admins only', description: 'Owner and admins see it', icon: 'shield-outline' },
  { id: 'medical_limited', label: 'Medical circle', description: 'Owner, admins, and people you pick', icon: 'medkit-outline' },
];

export function VisibilityPicker({
  groupId, scope, recipientIds, onScopeChange, onRecipientsChange, medicalMode,
}: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: members } = useFamilyMembers(groupId);

  const visibleScopes = medicalMode
    ? SCOPES.filter((s) => s.id !== 'group')
    : SCOPES;

  const toggleRecipient = (uid: string) => {
    if (recipientIds.includes(uid)) {
      onRecipientsChange(recipientIds.filter((x) => x !== uid));
    } else {
      onRecipientsChange([...recipientIds, uid]);
    }
  };

  const showRecipientList = scope === 'selected_members' || scope === 'medical_limited';

  return (
    <View style={s.container}>
      <Text style={s.label}>Who can see this?</Text>
      <View style={s.scopeList}>
        {visibleScopes.map((opt) => {
          const active = scope === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[s.scopeRow, active && s.scopeRowActive]}
              onPress={() => onScopeChange(opt.id)}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={active ? CandonColors.primary : CandonColors.textSecondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, active && s.scopeLabelActive]}>{opt.label}</Text>
                <Text style={s.scopeDesc}>{opt.description}</Text>
              </View>
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={active ? CandonColors.primary : CandonColors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {showRecipientList && (
        <View style={{ marginTop: 12 }}>
          <Text style={s.label}>
            Who gets access? ({recipientIds.length} selected)
          </Text>
          {(!members || members.length <= 1) && (
            <Text style={s.emptyNote}>No other members to add yet.</Text>
          )}
          {members?.filter((m) => m.user_id !== userId).map((m) => {
            const selected = recipientIds.includes(m.user_id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.memberRow, selected && s.memberRowActive]}
                onPress={() => toggleRecipient(m.user_id)}
              >
                <View style={s.memberAvatar}>
                  <Ionicons name="person" size={14} color={CandonColors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName}>{m.user_id.slice(0, 8)}…</Text>
                  <Text style={s.memberRole}>{m.role}</Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selected ? CandonColors.primary : CandonColors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, marginBottom: 4 },
  scopeList: { gap: 6 },
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  scopeRowActive: {
    borderColor: CandonColors.primary, backgroundColor: CandonColors.primaryFaint,
  },
  scopeLabel: { fontSize: 14, fontWeight: '500', color: CandonColors.textPrimary },
  scopeLabelActive: { color: CandonColors.primary, fontWeight: '600' },
  scopeDesc: { fontSize: 12, color: CandonColors.textMuted, marginTop: 1 },
  emptyNote: { fontSize: 13, color: CandonColors.textMuted, paddingVertical: 8 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, marginTop: 4,
    borderRadius: 10,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  memberRowActive: {
    borderColor: CandonColors.primary, backgroundColor: CandonColors.primaryFaint,
  },
  memberAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  memberName: { fontSize: 14, color: CandonColors.textPrimary, fontFamily: 'monospace' },
  memberRole: { fontSize: 11, color: CandonColors.textMuted, textTransform: 'capitalize' },
});
