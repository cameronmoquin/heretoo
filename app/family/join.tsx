import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useJoinFamily } from '../../hooks/useFamily';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function JoinFamily() {
  const s = makeStyles();
  const join = useJoinFamily();
  const [code, setCode] = useState('');

  const submit = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      showAlert('Invalid code', 'Check your code and try again.');
      return;
    }
    join.mutate(trimmed, {
      onSuccess: (family) => router.replace(`/family/${family.id}`),
      onError: (e: any) => showAlert('Could not join', e?.message ?? 'Check the code.'),
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.scroll}>
          <Text style={s.label}>Invite code</Text>
          <TextInput
            style={s.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC12345"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            maxLength={12}
            autoCorrect={false}
            autoFocus
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <Text style={s.hint}>
            Ask the family member who invited you for the 8-character code.
          </Text>
          <TouchableOpacity
            style={[s.saveBtn, join.isPending && { opacity: 0.5 }]}
            onPress={submit}
            disabled={join.isPending}
          >
            <Text style={s.saveBtnText}>{join.isPending ? 'Joining…' : 'Join family'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 480, alignSelf: 'center', width: '100%' },
  label: {
    fontSize: 12, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8,
  },
  codeInput: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: 8, lineHeight: 18 },
  saveBtn: {
    marginTop: 24, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
}); }
