/**
 * /inbox/[threadId] — one conversation. Marks it read on open and as new
 * messages arrive. Live via realtime, with a 10 s poll behind it.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Page, Muted, Loading, ErrorLine, SignedInOnly, inputStyle } from '../../components/nffga/board/Page';
import { MessageBubble } from '../../components/nffga/inbox/MessageBubble';
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { useSession } from '../../lib/nffga/useSession';
import {
  inboxKeys, markThreadRead, MESSAGE_MAX, sendMessage, useThread, useThreadMessages,
} from '../../lib/nffga/messages';

export default function ThreadScreen() {
  return (
    <SignedInOnly title="Inbox" reason="to send and read messages">
      <Conversation />
    </SignedInOnly>
  );
}

function Conversation() {
  const s = makeStyles();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const id = Array.isArray(threadId) ? threadId[0] : threadId;
  const { userId } = useSession();
  const qc = useQueryClient();
  const thread = useThread(id, userId);
  const messages = useThreadMessages(id, !!thread.data);
  const scrollRef = useRef<ScrollView>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = messages.data ?? [];
  const lastId = list.length ? list[list.length - 1].id : null;

  // Mark read on open and whenever a new message lands.
  useEffect(() => {
    if (!id || !thread.data) return;
    let live = true;
    markThreadRead(id).then(() => {
      if (live) qc.invalidateQueries({ queryKey: ['nffga', 'inbox', 'threads'] });
    });
    return () => { live = false; };
  }, [id, thread.data, lastId, qc]);

  const send = async () => {
    if (!id || !userId || !body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await sendMessage(id, userId, body);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? null); return; }
    setBody('');
    qc.invalidateQueries({ queryKey: inboxKeys.messages(id) });
    qc.invalidateQueries({ queryKey: ['nffga', 'inbox', 'threads'] });
  };

  if (thread.isLoading) return <Page title="Inbox"><Loading /></Page>;
  if (!thread.data) {
    return (
      <Page title="Inbox">
        <Muted>This conversation is not available.</Muted>
        <View style={s.row}>
          <Button title="Back to inbox" onPress={() => router.replace('/inbox' as any)} variant="outline" size="md" />
        </View>
      </Page>
    );
  }

  const t = thread.data;
  const name = t.other?.display_name || 'Member';

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: name }} />
      <View style={s.head}>
        <View style={s.headInner}>
          <Button title="Inbox" onPress={() => router.push('/inbox' as any)} variant="ghost" size="sm" />
          <View style={s.headText}>
            <Pressable
              onPress={() => t.other && router.push(`/members/${t.other.user_id}` as any)}
              accessibilityRole="link"
            >
              <Text style={s.name} numberOfLines={1}>{name}</Text>
            </Pressable>
            {t.other?.department ? <Text style={s.meta} numberOfLines={1}>{t.other.department}</Text> : null}
          </View>
        </View>
        {t.gear_listing_id ? (
          <View style={s.headInner}>
            <Pressable onPress={() => router.push(`/gear/${t.gear_listing_id}` as any)} accessibilityRole="link">
              <Text style={s.gear}>{t.subject ? `About: ${t.subject}` : 'About a gear listing'}  ·  View listing</Text>
            </Pressable>
          </View>
        ) : t.subject ? (
          <View style={s.headInner}><Text style={s.meta}>{t.subject}</Text></View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.column}>
          {messages.isLoading ? <Loading /> : null}
          {!messages.isLoading && list.length === 0 ? <Muted>No messages yet.</Muted> : null}
          {list.map((m) => <MessageBubble key={m.id} message={m} mine={m.author_id === userId} />)}
        </View>
      </ScrollView>

      <View style={s.composer}>
        <View style={s.composerInner}>
          <ErrorLine>{error}</ErrorLine>
          <View style={s.composeRow}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write a message"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={MESSAGE_MAX}
              style={[inputStyle(), s.input]}
              accessibilityLabel="Message text"
              onKeyPress={(e) => {
                // Web: Enter sends, Shift+Enter makes a new line.
                const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) {
                  (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                  send();
                }
              }}
            />
            <Button title="Send" onPress={send} variant="primary" size="md" loading={busy} disabled={!body.trim()} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles() { return StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  row: { flexDirection: 'row' },
  head: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Spacing.xs },
  headInner: {
    width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
  },
  headText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
  },
  meta: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  gear: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textPrimary,
    textDecorationLine: 'underline', paddingBottom: Spacing.xxs,
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.md, gap: Spacing.sm },
  composer: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  composerInner: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.md, gap: Spacing.xs },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },
  input: { flex: 1, maxHeight: 160, textAlignVertical: 'top' },
}); }
