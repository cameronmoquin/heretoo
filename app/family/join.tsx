import React, { useState } from 'react';
import {
  View, TextInput, StyleSheet,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useJoinFamily } from '../../hooks/useFamily';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

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
          <Eyebrow style={s.label}>Invite code</Eyebrow>
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
          <Button
            title={join.isPending ? 'Joining…' : `Join ${Vocab.group}`}
            onPress={submit}
            disabled={join.isPending}
            size="lg"
            style={s.saveBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, gap: 6, maxWidth: 480, alignSelf: 'center', width: '100%' },
  label: { marginTop: Spacing.lg, marginBottom: Spacing.xs },
  codeInput: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: Spacing.md,
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: { marginTop: Spacing.lg },
}); }
