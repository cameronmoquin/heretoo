import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateFamilyGroup, useFamilyGroup } from '../../../hooks/useFamilyGroups';
import { showAlert } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';
import { formatPgError } from '../../../lib/error-format';

export default function NewFamily() {
  // ?from=<group_id> — required: a new family must be spawned from inside an
  // existing one (the Candon propagation rule).
  const { from } = useLocalSearchParams<{ from?: string }>();
  const parentGroupId = typeof from === 'string' ? from : null;
  const { data: parent } = useFamilyGroup(parentGroupId);

  const create = useCreateFamilyGroup();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const save = () => {
    if (!parentGroupId) {
      showAlert(
        'Open from a family',
        'A new family group has to be started from inside an existing one. Open one of yours and tap "Spin off a new family".',
      );
      return;
    }
    if (!name.trim()) {
      showAlert('Missing name', 'Give your group a name.');
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        parent_family_group_id: parentGroupId,
      },
      {
        onSuccess: (g) => {
          router.replace(`/candon/family/${g.id}`);
        },
        onError: (e: unknown) => {
          const f = formatPgError(e, 'Could not create the group.');
          showAlert('Could not create', f.message);
        },
      },
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {parent ? (
            <View style={s.lineageBox}>
              <Text style={s.lineageLabel}>Spinning off from</Text>
              <Text style={s.lineageName}>{parent.name}</Text>
              <Text style={s.lineageHint}>
                The new family will be linked to this one. They stay private from each other,
                but the connection contributes to the public family-tree network stats.
              </Text>
            </View>
          ) : (
            <View style={s.warningBox}>
              <Text style={s.warningText}>
                A new family group has to be started from inside an existing one. Go back to a
                family you belong to and tap &quot;Spin off a new family&quot;.
              </Text>
            </View>
          )}

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
            style={[s.saveBtn, (create.isPending || !parentGroupId) && { opacity: 0.5 }]}
            onPress={save}
            disabled={create.isPending || !parentGroupId}
          >
            <Text style={s.saveBtnText}>
              {create.isPending ? 'Creating…' : 'Create group'}
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
  lineageBox: {
    backgroundColor: CandonColors.primaryFaint, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, marginBottom: 8,
  },
  lineageLabel: {
    fontSize: 11, color: CandonColors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  lineageName: { fontSize: 18, fontWeight: '700', color: CandonColors.primary, marginTop: 4 },
  lineageHint: { fontSize: 12, color: CandonColors.textSecondary, marginTop: 6, lineHeight: 18 },
  warningBox: {
    backgroundColor: CandonColors.surfaceRaise, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border, marginBottom: 8,
  },
  warningText: { fontSize: 13, color: CandonColors.textSecondary, lineHeight: 19 },
});
