/**
 * PasswordCard — set or change the signed-in person's password. The
 * first-time step after an admin arrives by the emailed link. Moved
 * unchanged from app/admin.tsx.
 */
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../shared/Button';
import { Eyebrow } from '../../shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { makeAdminStyles } from './styles';

export function PasswordCard({ firstTime }: { firstTime: boolean }) {
  const s = makeAdminStyles();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setMsg(null);
    if (pw.length < 8) { setMsg({ ok: false, text: 'Use at least 8 characters.' }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: "The two passwords don't match." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(''); setPw2('');
    setMsg({ ok: true, text: 'Password saved. Next time, sign in with your email and this password.' });
  };

  return (
    <View style={s.card}>
      <Eyebrow>{firstTime ? 'Set your password' : 'Change password'}</Eyebrow>
      <TextInput
        style={s.input} value={pw} onChangeText={setPw} secureTextEntry
        placeholder="New password (8+)" placeholderTextColor={Colors.textMuted}
        autoComplete="new-password"
      />
      <TextInput
        style={s.input} value={pw2} onChangeText={setPw2} secureTextEntry
        placeholder="Type it again" placeholderTextColor={Colors.textMuted}
        autoComplete="new-password" onSubmitEditing={save}
      />
      {msg && <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text>}
      <Button title={busy ? 'Saving…' : 'Save password'} onPress={save} loading={busy} disabled={busy || !pw || !pw2} variant="primary" size="md" />
    </View>
  );
}
