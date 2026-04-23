import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContacts, type Contact } from '../../../hooks/useContacts';
import { CandonColors } from '../../../constants/candon-theme';

export default function ContactsList() {
  const { data: contacts, isLoading } = useContacts();

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.title}>Contacts</Text>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push('/candon/contacts/new')}
          >
            <Ionicons name="add" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 40 }} />}

        {!isLoading && (!contacts || contacts.length === 0) && (
          <View style={s.empty}>
            <Ionicons name="person-add-outline" size={36} color={CandonColors.textMuted} />
            <Text style={s.emptyTitle}>No contacts yet.</Text>
            <Text style={s.emptyText}>Add the people you want to stay in touch with.</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => router.push('/candon/contacts/new')}
            >
              <Text style={s.emptyBtnText}>Add your first contact</Text>
            </TouchableOpacity>
          </View>
        )}

        {contacts?.map((c) => <ContactRow key={c.id} contact={c} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const initials = contact.display_name
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const meta = [contact.relationship_type, contact.organization].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => router.push(`/candon/contacts/${contact.id}`)}
      activeOpacity={0.7}
    >
      <View style={s.avatar}>
        <Text style={s.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{contact.display_name}</Text>
        {!!meta && <Text style={s.rowMeta}>{meta}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={CandonColors.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 8, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: CandonColors.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CandonColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CandonColors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: CandonColors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '600', color: CandonColors.primary, fontSize: 14 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: CandonColors.textPrimary },
  rowMeta: { fontSize: 12, color: CandonColors.textMuted, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 8 },
  emptyText: { fontSize: 14, color: CandonColors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, backgroundColor: CandonColors.primary,
  },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
