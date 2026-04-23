import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateFamilyGroup } from '../../../hooks/useFamilyGroups';
import { showAlert } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';

export default function NewFamily() {
  const create = useCreateFamilyGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const save = () => {
    if (!name.trim()) {
      showAlert('Missing name', 'Give your group a name.');
      return;
    }
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: (g) => {
          router.replace(`/candon/family/${g.id}`);
        },
        onError: (e: any) => showAlert('Failed', e.message),
      }
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.label}>Group name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="The Moquins"
            placeholderTextColor={CandonColors.textMuted}
            returnKeyType="next"
            autoFocus
          />

          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this group is for."
            placeholderTextColor={CandonColors.textMuted}
            multiline
            maxLength={300}
            textAlignVertical="top"
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <TouchableOpacity
            style={[s.saveBtn, create.isPending && { opacity: 0.5 }]}
            onPress={save}
            disabled={create.isPending}
          >
            <Text style={s.saveBtnText}>
              {create.isPending ? 'Creating...' : 'Create group'}
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
  saveBtn: {
    marginTop: 24, backgroundColor: CandonColors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
