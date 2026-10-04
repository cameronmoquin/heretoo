/**
 * CopyTab — edit the website text registered in constants/siteCopy.ts.
 * Each line shows where it appears and its default; Save stores a value
 * in nffga_site_copy, Reset to default deletes it. Changes show to
 * visitors on their next page load (the copy is cached for ten minutes
 * in an open tab).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import { COPY_KEYS, COPY_MAX_LENGTH, SITE_COPY, type CopyEntry, type CopyKey } from '../../../constants/siteCopy';
import { copyKeys, resetCopy, saveCopy, useSiteCopy, type CopyRow } from '../../../lib/nffga/copy';
import { makeAdminStyles } from './styles';

export function CopyTab() {
  const s = makeAdminStyles();
  const q = useSiteCopy();
  return (
    <View style={s.section}>
      <Text style={s.h2} accessibilityRole="header">Website copy</Text>
      <Text style={s.muted}>
        Change the text on these parts of the site. Reset to default puts back the original wording.
      </Text>
      {q.isLoading ? <ActivityIndicator color={Colors.primary} /> : COPY_KEYS.map((k) => (
        <CopyItem key={k} k={k} saved={q.data?.[k]} />
      ))}
    </View>
  );
}

function CopyItem({ k, saved }: { k: CopyKey; saved?: CopyRow }) {
  const s = makeAdminStyles();
  const qc = useQueryClient();
  const entry: CopyEntry = SITE_COPY[k];
  const current = saved ? saved.value : entry.default;
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setValue(current); }, [current]);

  const dirty = value !== current;
  const blankNotAllowed = !value.trim() && !entry.allowEmpty;

  const save = async () => {
    setMsg(null); setBusy('save');
    const res = await saveCopy(k, value);
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: res.error ?? 'Could not save.' }); return; }
    setMsg({ ok: true, text: 'Saved.' });
    qc.invalidateQueries({ queryKey: copyKeys.all });
  };

  const reset = async () => {
    setMsg(null); setBusy('reset');
    const res = await resetCopy(k);
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: res.error ?? 'Could not reset.' }); return; }
    setValue(entry.default);
    setMsg({ ok: true, text: 'Back to the default.' });
    qc.invalidateQueries({ queryKey: copyKeys.all });
  };

  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <Text style={[s.h3, s.grow]}>{entry.label}</Text>
        <Text style={s.muted}>{saved ? `Edited ${new Date(saved.updated_at).toLocaleDateString()}` : 'Using default'}</Text>
      </View>
      <Text style={s.muted}>{entry.where}</Text>
      <Text style={s.secondary}>Default: {entry.default ? `“${entry.default}”` : '(empty, hidden)'}</Text>
      <TextInput
        style={[s.input, entry.multiline ? { minHeight: 88, textAlignVertical: 'top' } : null]}
        value={value}
        onChangeText={(t) => { setValue(t); setMsg(null); }}
        multiline={!!entry.multiline}
        maxLength={COPY_MAX_LENGTH}
        placeholder={entry.allowEmpty ? 'Empty: hidden on the site' : ''}
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={entry.label}
      />
      {blankNotAllowed ? <Text style={s.err}>This line needs words. Use Reset to default to undo an edit.</Text> : null}
      {msg ? <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text> : null}
      <View style={s.actions}>
        <Button title="Save" onPress={save} variant="primary" size="sm" loading={busy === 'save'} disabled={!dirty || blankNotAllowed || !!busy} />
        {saved ? <Button title="Reset to default" onPress={reset} variant="outline" size="sm" loading={busy === 'reset'} disabled={!!busy} /> : null}
        {dirty ? <Button title="Undo changes" onPress={() => { setValue(current); setMsg(null); }} variant="ghost" size="sm" /> : null}
      </View>
    </View>
  );
}
