/**
 * AccountTab — the signed-in admin's own account: change the sign-in
 * email, and set or change the password.
 *
 * Email: supabase.auth.updateUser({ email }). The shared project
 * auto-confirms, so the change usually applies at once; if it does not,
 * Supabase sends a confirmation link to the new address. Once it has
 * applied, nffga_sync_my_admin_email() (migration 110) moves this
 * admin's designation row to the new address. The seat itself is keyed
 * by user id, so it is unaffected either way.
 */
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Button } from '../../shared/Button';
import { Eyebrow } from '../../shared/Eyebrow';
import { Colors } from '../../../constants/colors';
import { Spacing } from '../../../constants/design';
import { changeMyEmail } from '../../../lib/nffga/siteAdmin';
import { PasswordCard } from './PasswordCard';
import { makeAdminStyles } from './styles';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AccountTab({ email, onEmailChanged, firstTime }: {
  email: string;
  onEmailChanged: (email: string) => void;
  firstTime: boolean;
}) {
  const s = makeAdminStyles();
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setMsg(null);
    const a = next.trim().toLowerCase();
    if (!EMAIL_RE.test(a)) { setMsg({ ok: false, text: 'Enter a full email address.' }); return; }
    if (a !== next2.trim().toLowerCase()) { setMsg({ ok: false, text: "The two addresses don't match." }); return; }
    if (a === email.toLowerCase()) { setMsg({ ok: false, text: 'That is already your sign-in email.' }); return; }
    setBusy(true);
    const res = await changeMyEmail(a);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
    setNext(''); setNext2('');
    if (res.outcome === 'changed') {
      onEmailChanged(res.email);
      setMsg({ ok: true, text: `Your sign-in email is now ${res.email}. Use it with your password next time. Your admin seat is unchanged.` });
    } else {
      setMsg({ ok: true, text: `A confirmation link was sent to ${res.email}. Open it to finish the change. Until then, keep signing in with ${email}.` });
    }
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={s.card}>
        <Eyebrow>Sign-in email</Eyebrow>
        <TextInput style={[s.input, s.inputReadOnly]} value={email} editable={false} accessibilityLabel="Current sign-in email" />
        <TextInput
          style={s.input} value={next} onChangeText={(t) => { setNext(t); setMsg(null); }}
          placeholder="New email" placeholderTextColor={Colors.textMuted}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        />
        <TextInput
          style={s.input} value={next2} onChangeText={(t) => { setNext2(t); setMsg(null); }}
          placeholder="Type the new email again" placeholderTextColor={Colors.textMuted}
          autoCapitalize="none" keyboardType="email-address" autoComplete="off" onSubmitEditing={save}
        />
        {msg && <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text>}
        <Button title={busy ? 'Saving…' : 'Save email'} onPress={save} loading={busy} disabled={busy || !next.trim() || !next2.trim()} variant="primary" size="md" />
      </View>

      <PasswordCard firstTime={firstTime} />
    </View>
  );
}
