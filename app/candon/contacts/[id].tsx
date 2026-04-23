import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContact, useDeleteContact } from '../../../hooks/useContacts';
import { showConfirm } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: contact, isLoading } = useContact(id);
  const deleteContact = useDeleteContact();

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (!contact) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Contact not found.</Text>
      </SafeAreaView>
    );
  }

  const initials = contact.display_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const onDelete = () => {
    showConfirm(
      'Delete contact?',
      `${contact.display_name} will be removed permanently.`,
      () => {
        deleteContact.mutate(contact.id, {
          onSuccess: () => router.back(),
        });
      },
      'Delete',
    );
  };

  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <View style={s.row}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue} selectable>{value}</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.name}>{contact.display_name}</Text>
        <Text style={s.relationship}>{contact.relationship_type}</Text>

        <View style={s.card}>
          <Row label="Phone" value={contact.phone_e164} />
          <Row label="Email" value={contact.email} />
          <Row label="Check in every" value={`${contact.preferred_frequency_days} days`} />
          <Row label="Closeness" value={`${contact.closeness_score} / 100`} />
          <Row label="Last contact" value={contact.last_contact_at ? new Date(contact.last_contact_at).toLocaleDateString() : 'Never'} />
        </View>

        {contact.notes ? (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={s.notes}>{contact.notes}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={s.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={CandonColors.error} />
          <Text style={s.deleteBtnText}>Delete contact</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 16, alignItems: 'center', maxWidth: 600, alignSelf: 'center', width: '100%' },
  empty: { padding: 40, textAlign: 'center', color: CandonColors.textMuted },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  avatarText: { fontSize: 24, fontWeight: '600', color: CandonColors.primary },
  name: { fontSize: 20, fontWeight: '600', color: CandonColors.textPrimary },
  relationship: { fontSize: 14, color: CandonColors.textSecondary, marginTop: -8 },
  card: {
    width: '100%', backgroundColor: CandonColors.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: CandonColors.border, gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 13, color: CandonColors.textSecondary },
  rowValue: { fontSize: 14, color: CandonColors.textPrimary, textAlign: 'right', flex: 1 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  notes: { fontSize: 14, color: CandonColors.textPrimary, lineHeight: 20 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 8,
  },
  deleteBtnText: { color: CandonColors.error, fontSize: 14, fontWeight: '500' },
});
