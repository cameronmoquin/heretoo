import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateFamily } from '../../hooks/useFamily';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
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
            <Eyebrow>Starting {Vocab.groupWithArticle}</Eyebrow>
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

          <Button
            title={create.isPending ? 'Creating…' : `Create ${Vocab.group}`}
            onPress={save}
            disabled={create.isPending}
            size="lg"
            style={s.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  label: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    fontWeight: '600', color: Colors.textSecondary,
    marginTop: Spacing.sm, marginBottom: Spacing.xxs,
  },
  input: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  saveBtn: { marginTop: Spacing.lg },
  lineageBox: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xs,
  },
}); }
