import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateFamily } from '../../hooks/useFamily';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

export default function NewFamily() {
  const s = makeStyles();
  const create = useCreateFamily();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const save = () => {
    if (!name.trim()) {
      showAlert('Missing name', `Give your ${Vocab.group} a name.`);
      return;
    }
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: (g) => router.replace(`/family/${g.id}`),
        onError: (e: any) => showAlert('Could not create', e?.message ?? 'Try again.'),
      },
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.lineageBox}>
            <Text style={s.lineageLabel}>Starting {Vocab.groupWithArticle}</Text>
          </View>

          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="The Capulets"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="next"
            autoFocus
            maxLength={80}
          />

          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
            textAlignVertical="top"
            onSubmitEditing={save}
          />

          <TouchableOpacity
            style={[s.saveBtn, create.isPending && { opacity: 0.5 }]}
            onPress={save}
            disabled={create.isPending}
          >
            <Text style={s.saveBtnText}>
              {create.isPending ? 'Creating…' : `Create ${Vocab.group}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  saveBtn: {
    marginTop: 24, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  lineageBox: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  lineageLabel: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
}); }
