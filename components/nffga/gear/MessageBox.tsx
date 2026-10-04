/**
 * MessageBox — a short first message that opens (or reuses) a thread
 * about a listing, then goes to the conversation.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../shared/Button';
import { Spacing } from '../../../constants/design';
import { messageSeller } from '../../../lib/nffga/gear';
import { ErrorText, TextField } from '../tournaments/ui';

export function MessageBox({ to, listingId, label, initial, onCancel }: {
  to: string; listingId: string; label: string; initial?: string; onCancel: () => void;
}) {
  const s = makeStyles();
  const [body, setBody] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    if (!body.trim()) { setErr('Write a message first.'); return; }
    setBusy(true); setErr(null);
    const r = await messageSeller(to, body.trim(), listingId);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    router.push(`/inbox/${r.threadId}` as any);
  }

  return (
    <View style={s.box}>
      <TextField label={label} value={body} onChangeText={setBody} multiline={3} maxLength={2000} />
      <ErrorText>{err}</ErrorText>
      <View style={s.actions}>
        <Button title="Send" onPress={send} variant="primary" loading={busy} />
        <Button title="Cancel" onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  box: { gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
}); }
