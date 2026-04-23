import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useJoinFamilyGroup } from '../../../hooks/useFamilyGroups';
import { showAlert } from '../../../lib/alert';
import { CandonColors } from '../../../constants/candon-theme';

export default function JoinFamily() {
  const join = useJoinFamilyGroup();
  const [code, setCode] = useState('');

  const submit = () => {
    if (code.trim().length < 4) {
      showAlert('Invalid code', 'Check your invite and try again.');
      return;
    }
    join.mutate(code.trim().toUpperCase(), {
      onSuccess: (g: any) => {
        router.replace(`/candon/family/${g.id}`);
      },
      onError: (e: any) => showAlert('Failed', e.message),
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.heading}>Join a family group</Text>
          <Text style={s.sub}>Enter the invite code someone shared with you.</Text>

          <TextInput
            style={s.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="CODE"
            placeholderTextColor={CandonColors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            returnKeyType="go"
            onSubmitEditing={submit}
            autoFocus
          />

          <TouchableOpacity
            style={[s.btn, join.isPending && { opacity: 0.5 }]}
            onPress={submit}
            disabled={join.isPending}
          >
            <Text style={s.btnText}>{join.isPending ? 'Joining...' : 'Join'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 12, maxWidth: 500, alignSelf: 'center', width: '100%' },
  heading: { fontSize: 20, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 20 },
  sub: { fontSize: 14, color: CandonColors.textSecondary, marginBottom: 12 },
  codeInput: {
    backgroundColor: CandonColors.surface, borderWidth: 1, borderColor: CandonColors.border,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 4,
    color: CandonColors.textPrimary,
  },
  btn: {
    marginTop: 12, backgroundColor: CandonColors.primary, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
