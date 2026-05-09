/**
 * Family group chat — drop-in panel for the /family/[id] page.
 *
 * Renders the message list (oldest at top, newest at bottom, auto-
 * scrolls when new arrivals land), then a composer pinned to the
 * bottom with mic-input support. Singleton family-chat row is
 * looked up / created lazily by useFamilyChat.
 *
 * Visual model: message bubbles are color-coded — sender's bubble is
 * primary indigo (white text), others are surface (text primary). Same
 * convention as the 1:1 chat thread page so both feel like "messaging."
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyChat, useFamilyChatMessages, useSendFamilyChatMessage } from '../../hooks/useFamilyChat';
import { useFamilyMembersWithProfiles } from '../../hooks/useFamily';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { MicInputButton } from '../shared/MicInputButton';
import { ReframerDrawer, ReframerEye } from '../chat/ReframerDrawer';
import { useReframer, type ReframerContextMessage } from '../../hooks/useReframer';

interface Props {
  familyId: string;
}

export function FamilyChatPanel({ familyId }: Props) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  const { data: chat, isLoading: chatLoading } = useFamilyChat(familyId);
  const { data: messages, isLoading: messagesLoading } = useFamilyChatMessages(chat?.id ?? null);
  const send = useSendFamilyChatMessage();

  // Reframer (M8) — opt-in escalation drawer for family chat.
  const reframerContext = React.useMemo<ReframerContextMessage[]>(
    () =>
      (messages ?? []).slice(-3).map((m: any) => ({
        from: m.sender_id === userId ? ('me' as const) : ('them' as const),
        body: m.body ?? '',
      })),
    [messages, userId],
  );
  const reframer = useReframer({ surface: 'family_chat', draft, context: reframerContext });

  // Member lookup so each bubble can show the sender's name + avatar
  // without re-fetching per message.
  const { data: members } = useFamilyMembersWithProfiles(familyId);
  const profileById = new Map(
    (members ?? []).map((m) => [m.profile_id, m.profile]),
  );

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages?.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || !chat?.id) return;
    send.mutate(
      { chatId: chat.id, body },
      {
        onSuccess: () => setDraft(''),
        onError: (e: any) => showAlert('Could not send', e?.message ?? 'Try again.'),
      },
    );
  };

  const noMessagesYet = !messages || messages.length === 0;
  if (chatLoading || (!!chat && messagesLoading && noMessagesYet)) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll}>
        {(messages ?? []).length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={28} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Start the conversation</Text>
            <Text style={s.emptySub}>
              Family chat lives here. Updates from earlier in the day, plans for the weekend, the small stuff.
            </Text>
          </View>
        ) : (
          (messages ?? []).map((m, i) => {
            const isMine = m.sender_id === userId;
            const author = profileById.get(m.sender_id);
            const prev = i > 0 ? messages![i - 1] : null;
            // Group consecutive messages from same sender — only show the
            // avatar+name on the first message of the run.
            const startsRun = !prev || prev.sender_id !== m.sender_id;
            return (
              <View
                key={m.id}
                style={[s.row, isMine ? s.rowMine : s.rowTheirs]}
              >
                {!isMine && (
                  <View style={s.avatarWrap}>
                    {startsRun && author?.avatar_path ? (
                      <Image source={{ uri: mediaPathToUrl(author.avatar_path) }} style={s.avatarImg} />
                    ) : startsRun ? (
                      <View style={s.avatarFallback}>
                        <Text style={s.avatarTxt}>
                          {(author?.display_name ?? author?.handle ?? '?').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    ) : (
                      <View style={s.avatarSpacer} />
                    )}
                  </View>
                )}
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
                  {!isMine && startsRun && (
                    <Text style={s.bubbleAuthor}>
                      {author?.display_name ?? author?.handle ?? 'Unknown'}
                    </Text>
                  )}
                  <Text style={[s.bubbleText, isMine && s.bubbleTextMine]}>{m.body}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Composer pinned at the bottom of the panel. */}
      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={4000}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
        />
        <MicInputButton
          size={20}
          onText={(t) => setDraft((d) => (d ? `${d} ${t}`.trim() : t))}
        />
        <ReframerEye visible={reframer.eyeVisible} onPress={reframer.open} />
        <TouchableOpacity
          style={[s.sendBtn, (!draft.trim() || send.isPending) && { opacity: 0.4 }]}
          onPress={submit}
          disabled={!draft.trim() || send.isPending}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ReframerDrawer
        visible={reframer.drawerOpen}
        loading={reframer.loading}
        result={reframer.result}
        error={reframer.error}
        onClose={reframer.close}
        onUseAlternative={(text) => {
          setDraft(text);
          reframer.markAccepted();
          reframer.close();
        }}
      />
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, minHeight: 360 },
  loading: { padding: Spacing.lg, alignItems: 'center' },

  scroll: { padding: Spacing.md, gap: 4, paddingBottom: 12 },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  emptySub: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center',
    maxWidth: 320, lineHeight: 19,
  },

  row: { flexDirection: 'row', gap: 6, marginVertical: 1 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  avatarWrap: { width: 28, alignItems: 'center' },
  avatarImg: { width: 28, height: 28, borderRadius: 6 },
  avatarFallback: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  avatarSpacer: { width: 28, height: 1 },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleAuthor: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    marginBottom: 2,
  },
  bubbleText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 19 },
  bubbleTextMine: { color: '#FFF' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  input: {
    flex: 1, backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary, maxHeight: 120,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
}); }
