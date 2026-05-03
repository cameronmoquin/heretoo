/**
 * Single chat thread.
 *
 * Top: back button + the other person's name/avatar.
 * Body: scrollable message list, newest at bottom, sender's bubble
 *       right-aligned + colored, recipient's left-aligned + neutral.
 * Footer: composer pinned to bottom.
 *
 * If the thread is in 'pending' status and the viewer is the
 * recipient, the composer is replaced with an Accept / Decline pair
 * so the request can't accidentally turn into a one-way reply tunnel.
 *
 * If the thread is 'pending' and the viewer is the initiator, the
 * composer is disabled with an "Awaiting response…" hint after the
 * one allowed intro message has been sent.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  useThread, useThreadMessages, useSendMessage,
  useAcceptThread, useDeclineThread, useMarkThreadRead,
} from '../../hooks/useChat';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { MicInputButton } from '../../components/shared/MicInputButton';

export default function ChatThread() {
  const s = makeStyles();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const { data: thread, isLoading: threadLoading } = useThread(threadId);
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(threadId);
  const send = useSendMessage();
  const accept = useAcceptThread();
  const decline = useDeclineThread();
  const markRead = useMarkThreadRead();

  const otherId = thread
    ? (thread.participant_a === userId ? thread.participant_b : thread.participant_a)
    : null;

  const { data: other } = useQuery({
    queryKey: ['profile', otherId],
    queryFn: async () => {
      if (!otherId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, handle, display_name, avatar_path')
        .eq('id', otherId)
        .maybeSingle();
      return data;
    },
    enabled: !!otherId,
  });

  // Scroll to bottom when messages arrive.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages?.length]);

  // Mark inbound messages as read whenever there's at least one unread
  // message from the other party. Fires on initial load and again
  // whenever realtime delivers a new inbound — so the unread badge
  // tracks "messages I haven't actually seen" rather than "messages
  // that exist." Idempotent: the RPC no-ops when there's nothing to
  // mark, so re-firing on every realtime tick is cheap.
  useEffect(() => {
    if (!threadId || !userId || !messages) return;
    const hasUnreadInbound = messages.some(
      (m) => m.sender_id !== userId && m.read_at === null,
    );
    if (!hasUnreadInbound) return;
    markRead.mutate(threadId);
    // markRead is stable across renders; including it would re-fire
    // unnecessarily because react-query mutations get fresh refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, userId, messages]);

  const isPending = thread?.status === 'pending';
  const viewerIsInitiator = thread?.initiator_id === userId;
  const viewerIsRecipient = isPending && !viewerIsInitiator;
  const initiatorIntroSent =
    isPending && viewerIsInitiator && (messages ?? []).some((m) => m.sender_id === userId);

  const submit = () => {
    const body = draft.trim();
    if (!body || !threadId) return;
    send.mutate(
      { threadId, body },
      {
        onSuccess: () => setDraft(''),
        onError: (e: any) => showAlert('Could not send', e?.message ?? 'Try again.'),
      },
    );
  };

  if (threadLoading || messagesLoading) {
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (!thread) {
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.empty}>Thread not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.replace('/chat' as any)}
            style={s.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={s.avatar}>
            {(other as any)?.avatar_path ? (
              <Image source={{ uri: mediaPathToUrl((other as any).avatar_path) }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarText}>
                {(((other as any)?.display_name ?? (other as any)?.handle ?? '?') as string).slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>
              {(other as any)?.display_name ?? (other as any)?.handle ?? 'Unknown'}
            </Text>
            {!!(other as any)?.handle && (
              <Text style={s.headerHandle}>@{(other as any).handle}</Text>
            )}
          </View>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll}>
          {(messages ?? []).map((m) => {
            const isMine = m.sender_id === userId;
            return (
              <View key={m.id} style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={isMine ? s.bubbleTextMine : s.bubbleTextTheirs}>{m.body}</Text>
                </View>
                <Text style={s.bubbleTime}>{relTime(m.created_at)}</Text>
              </View>
            );
          })}
          {(messages ?? []).length === 0 && (
            <Text style={s.noMessages}>No messages yet.</Text>
          )}
        </ScrollView>

        {/* Footer: depends on thread status + role */}
        {viewerIsRecipient ? (
          <View style={s.requestBar}>
            <Text style={s.requestText}>
              This is a message request from outside your network.
            </Text>
            <View style={s.requestRow}>
              <TouchableOpacity
                style={s.declineBtn}
                onPress={() => showConfirm(
                  'Decline this request?',
                  "They won't be able to send more messages.",
                  () => decline.mutate(thread.id, { onSuccess: () => router.replace('/chat' as any) }),
                  'Decline', 'Cancel',
                )}
              >
                <Text style={s.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.acceptBtn}
                onPress={() => accept.mutate(thread.id)}
              >
                <Text style={s.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : initiatorIntroSent ? (
          <View style={s.awaitingBar}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={s.awaitingText}>Awaiting response — one intro message at a time for new contacts.</Text>
          </View>
        ) : (
          <View style={s.composer}>
            <TextInput
              style={s.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder={isPending ? 'Send an intro message…' : 'Message…'}
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={submit}
            />
            <MicInputButton
              size={20}
              onText={(t) => setDraft((d) => (d ? `${d} ${t}`.trim() : t))}
            />
            <TouchableOpacity
              style={[s.composerSend, !draft.trim() && { opacity: 0.4 }]}
              onPress={submit}
              disabled={!draft.trim() || send.isPending}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  headerHandle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  scroll: { padding: Spacing.md, gap: 6, paddingBottom: 16 },
  noMessages: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },

  bubbleWrap: { maxWidth: '78%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: '#FFF', fontSize: 14, lineHeight: 19 },
  bubbleTextTheirs: { color: Colors.textPrimary, fontSize: 14, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 2, marginHorizontal: 4 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  composerInput: {
    flex: 1, backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, maxHeight: 100,
  },
  composerSend: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  requestBar: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.md, gap: 10,
  },
  requestText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  requestRow: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  declineBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  acceptBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 999,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  acceptBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13, letterSpacing: 0.1 },

  awaitingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 12,
  },
  awaitingText: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', flexShrink: 1 },
}); }
