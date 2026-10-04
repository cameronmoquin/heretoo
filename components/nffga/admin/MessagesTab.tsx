/**
 * MessagesTab — Contact Us messages (nffga_contact_messages, migration
 * 110), newest first. Opening a new message marks it read. Reply goes
 * out from the admin's own mail program (mailto), so the sender sees a
 * real person's address.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../shared/Button';
import { Colors } from '../../../constants/colors';
import {
  setContactStatus, siteAdminKeys, useContactMessages,
  type ContactMessage, type ContactStatus,
} from '../../../lib/nffga/siteAdmin';
import { SITE_NAME } from '../../../constants/site';
import { makeAdminStyles } from './styles';

type View_ = 'inbox' | 'archived';

export function MessagesTab() {
  const s = makeAdminStyles();
  const q = useContactMessages(true);
  const [view, setView] = useState<View_>('inbox');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = q.data ?? [];
  const inbox = rows.filter((m) => m.status !== 'archived');
  const archived = rows.filter((m) => m.status === 'archived');
  const unread = rows.filter((m) => m.status === 'new').length;
  const list = view === 'inbox' ? inbox : archived;

  return (
    <View style={s.section}>
      <Text style={s.h2} accessibilityRole="header">Messages</Text>
      <Text style={s.muted}>
        Sent from the Contact us page. Site admins get an email when one arrives; the message itself is only shown here.
      </Text>
      <View style={s.chips}>
        <Chip on={view === 'inbox'} label={`Inbox${unread ? ` (${unread} new)` : ''}`} onPress={() => setView('inbox')} />
        <Chip on={view === 'archived'} label={`Archived${archived.length ? ` (${archived.length})` : ''}`} onPress={() => setView('archived')} />
      </View>

      {q.isLoading ? <ActivityIndicator color={Colors.primary} /> : null}
      {!q.isLoading && list.length === 0 ? (
        <Text style={s.secondary}>{view === 'inbox' ? 'No messages.' : 'Nothing archived.'}</Text>
      ) : null}
      {list.map((m) => (
        <MessageRow key={m.id} m={m} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} />
      ))}
    </View>
  );
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const s = makeAdminStyles();
  return (
    <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function MessageRow({ m, open, onToggle }: { m: ContactMessage; open: boolean; onToggle: () => void }) {
  const s = makeAdminStyles();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<ContactStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isNew = m.status === 'new';

  const set = async (status: ContactStatus) => {
    setErr(null); setBusy(status);
    const res = await setContactStatus(m.id, status);
    setBusy(null);
    if (!res.ok) { setErr(res.error ?? 'Could not update.'); return; }
    qc.invalidateQueries({ queryKey: siteAdminKeys.messages });
  };

  const toggle = () => {
    onToggle();
    if (!open && isNew) void set('read');
  };

  const reply = () => {
    const subj = `Re: ${m.subject?.trim() || `Your message to ${SITE_NAME}`}`;
    Linking.openURL(`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subj)}`).catch(() => {});
  };

  const when = new Date(m.created_at);
  return (
    <View style={s.card}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={s.titleRow}>
          {isNew ? <View style={s.badge}><Text style={s.badgeText}>New</Text></View> : null}
          <Text style={[s.h3, s.grow]} numberOfLines={1}>{m.subject?.trim() || '(no subject)'}</Text>
        </View>
        <Text style={s.rowMeta}>
          {m.name} · {m.email} · {when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
        {!open ? <Text style={s.secondary} numberOfLines={2}>{m.body}</Text> : null}
      </Pressable>

      {open ? (
        <>
          <Text style={s.body} selectable>{m.body}</Text>
          {m.user_id ? <Text style={s.muted}>Sent while signed in to a member account.</Text> : null}
          {err ? <Text style={s.err}>{err}</Text> : null}
          <View style={s.actions}>
            <Button title="Reply by email" onPress={reply} variant="primary" size="sm" />
            {m.status === 'archived' ? (
              <Button title="Move to inbox" onPress={() => set('read')} variant="outline" size="sm" loading={busy === 'read'} />
            ) : (
              <>
                <Button title="Archive" onPress={() => set('archived')} variant="outline" size="sm" loading={busy === 'archived'} />
                <Button title="Mark unread" onPress={() => set('new')} variant="ghost" size="sm" loading={busy === 'new'} />
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}
