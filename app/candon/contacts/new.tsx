import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateContact } from '../../../hooks/useContacts';
import { showAlert } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';

const RELATIONSHIP_TYPES = [
  'close family', 'extended family', 'close friend', 'friend',
  'old friend', 'colleague', 'neighbor', 'other',
];

const FREQUENCIES = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Biweekly' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
  { days: 365, label: 'Yearly' },
];

export default function NewContact() {
  const createContact = useCreateContact();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState('friend');
  const [frequency, setFrequency] = useState(30);
  const [notes, setNotes] = useState('');

  const save = () => {
    if (!name.trim()) {
      showAlert('Missing name', 'Give your contact a name.');
      return;
    }
    createContact.mutate(
      {
        display_name: name.trim(),
        phone_e164: phone.trim() || null,
        email: email.trim() || null,
        relationship_type: relationshipType,
        preferred_frequency_days: frequency,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (e: any) => {
          showAlert('Failed', e.message);
        },
      }
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Smith"
            placeholderTextColor={CandonColors.textMuted}
            returnKeyType="next"
          />

          <Text style={s.label}>Phone</Text>
          <TextInput
            style={s.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 123 4567"
            placeholderTextColor={CandonColors.textMuted}
            keyboardType="phone-pad"
            returnKeyType="next"
          />

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="jane@example.com"
            placeholderTextColor={CandonColors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={s.label}>Relationship</Text>
          <View style={s.chipRow}>
            {RELATIONSHIP_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.chip, relationshipType === t && s.chipActive]}
                onPress={() => setRelationshipType(t)}
              >
                <Text style={[s.chipText, relationshipType === t && s.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Check in how often?</Text>
          <View style={s.chipRow}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f.days}
                style={[s.chip, frequency === f.days && s.chipActive]}
                onPress={() => setFrequency(f.days)}
              >
                <Text style={[s.chipText, frequency === f.days && s.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Notes</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything you want to remember."
            placeholderTextColor={CandonColors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[s.saveBtn, createContact.isPending && { opacity: 0.5 }]}
            onPress={save}
            disabled={createContact.isPending}
          >
            <Text style={s.saveBtnText}>
              {createContact.isPending ? 'Saving...' : 'Save contact'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { fontSize: 12, fontWeight: '600', color: CandonColors.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: CandonColors.textPrimary,
  },
  textarea: { minHeight: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
  },
  chipActive: { backgroundColor: CandonColors.primaryFaint, borderColor: CandonColors.primary },
  chipText: { fontSize: 13, color: CandonColors.textSecondary },
  chipTextActive: { color: CandonColors.primary, fontWeight: '600' },
  saveBtn: {
    marginTop: 24, backgroundColor: CandonColors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
