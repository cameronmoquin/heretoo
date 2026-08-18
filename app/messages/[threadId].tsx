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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOpenDrop, useRevealed, useRevealedBody } from '../../hooks/usePostViews';
import { supabase } from '../../lib/supabase';
import {
  useThread, useThreadMessages, useSendMessage,
  useAcceptThread, useDeclineThread, useMarkThreadRead,
} from '../../hooks/useChat';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { showAlert, showConfirm } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { MicInputButton } from '../../components/shared/MicInputButton';
import { ReframerDrawer, ReframerEye } from '../../components/chat/ReframerDrawer';
import { useReframer, type ReframerContextMessage } from '../../hooks/useReframer';
import { MOBILE_TAB_BAR_HEIGHT } from '../../components/shared/MobileTabBar';
import { GuestKeepBar } from '../../components/shared/GuestKeepBar';
import { useStartVideoCall } from '../../hooks/useStartVideoCall';
import { shouldShowLeftSidebar } from '../../components/shared/LeftSidebar';
import { useWindowDimensions } from 'react-native';

export default function ChatThread() {
  const s = makeStyles();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const userId = useAuthStore((st) => st.user?.id);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);
  const { width: vw } = useWindowDimensions();
  // When the LeftSidebar is up (≥1024px web), the MobileTabBar hides
  // and the composer sits flush with the viewport bottom. Otherwise
  // (mobile / narrow web) we reserve the tab bar's height so it
  // doesn't overlap the input.

  const { data: thread, isLoading: threadLoading } = useThread(threadId);
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(threadId);
  const send = useSendMessage();
  const accept = useAcceptThread();
  const decline = useDeclineThread();
  const markRead = useMarkThreadRead();
  const startCall = useStartVideoCall();

  // Video calls live here now (migration 074) — a call belongs to the
  // conversation, not to a page. The link goes into the thread as a
  // message so the other person's phone rings through the pipeline that
  // already exists: realtime, push, mail.
  const onStartCall = async () => {
    if (!threadId) return;
    try {
      const callId = await startCall.mutateAsync({ threadId });
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://heretoo.social';
      send.mutate({ threadId, body: `${origin}/call/${callId}` });
      router.push(`/call/${callId}` as any);
    } catch (e: any) {
      showAlert('Could not start the call', e?.message ?? 'Try again.');
    }
  };

  // Reframer (M8) — opt-in, never visible to the recipient. Builds
  // a small "context" of up to the last 3 messages from the thread
  // so the LLM can "read their note" alongside "your draft."
  const reframerContext = React.useMemo<ReframerContextMessage[]>(() => {
    return (messages ?? []).slice(-3).map((m: any) => ({
      from: m.sender_id === userId ? ('me' as const) : ('them' as const),
      body: m.body ?? '',
    }));
  }, [messages, userId]);
  const reframer = useReframer({ surface: 'dm', draft, context: reframerContext });

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

  // DIRECT DROPS BELONG IN THIS THREAD. They used to live only in the
  // feed's page-0 splice, so a drop sent to one person sat outside the
  // conversation with that person — and once burned, RLS pre-074 hid the
  // row entirely, which read as "my message randomly disappeared."
  // Migration 074 wipes the body but KEEPS the row (burned_at stamped),
  // so the thread can show a redaction where the drop used to be.
  const qc = useQueryClient();
  const { data: drops } = useQuery({
    queryKey: ['direct-drops', threadId],
    enabled: !!userId && !!otherId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*, media:post_media(*)')
        .eq('visibility', 'direct')
        .or(
          `and(author_id.eq.${userId},direct_recipient_id.eq.${otherId}),`
          + `and(author_id.eq.${otherId},direct_recipient_id.eq.${userId})`,
        )
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // One timeline, chat and drops interleaved by when they happened.
  const timeline = React.useMemo(() => {
    const items: Array<{ kind: 'msg' | 'drop'; at: string; m?: any; d?: any }> = [
      ...(messages ?? []).map((m: any) => ({ kind: 'msg' as const, at: m.created_at, m })),
      ...(drops ?? []).map((d: any) => ({ kind: 'drop' as const, at: d.created_at, d })),
    ];
    return items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }, [messages, drops]);

  // A drop landing (INSERT) or burning (UPDATE stamps burned_at) both
  // arrive on the posts channel; either way this thread's copy is stale.
  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`dm-drops:${threadId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: 'visibility=eq.direct' },
        () => qc.invalidateQueries({ queryKey: ['direct-drops', threadId] }),
      )
      // Rejoin = refetch; a burn that fired while the socket slept
      // otherwise never redacts on this screen.
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          qc.invalidateQueries({ queryKey: ['direct-drops', threadId] });
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [threadId, qc]);

  // Scroll to bottom when anything lands. The old version fired on a
  // 50ms timer after messages.length changed — on mobile the layout
  // (keyboard, images, fonts) routinely takes longer, so the scroll ran
  // before the new bubble had height and the newest message sat hidden
  // below the fold until the NEXT message scrolled it into view. The
  // reliable signal is the content actually changing size, wired on the
  // ScrollView below; this effect stays as a fallback for the cases
  // where content height doesn't change (e.g. a swap in place).
  useEffect(() => {
    if (!timeline || timeline.length === 0) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [timeline?.length]);

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

  // The flame. Armed, the send writes a burning direct drop instead of
  // a message — same machinery the feed's DMs use (074/075): sealed
  // until opened, overwritten at the moment of reading, files destroyed
  // within the hour, out after a day unopened. One burn system; the
  // chat composer is just another door into it.
  const [burn, setBurn] = useState(false);
  const [burnSending, setBurnSending] = useState(false);

  const sendBurningDrop = async (body: string) => {
    if (!userId || !otherId) throw new Error('Not ready');
    const { error } = await supabase.from('posts').insert({
      author_id: userId,
      body,
      visibility: 'direct',
      direct_recipient_id: otherId,
      kind: 'post',
      destruct_on_view: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ['direct-drops', threadId] });
  };

  const submit = () => {
    const body = draft.trim();
    if (!body || !threadId) return;
    if (burn) {
      setBurnSending(true);
      sendBurningDrop(body)
        .then(() => { setDraft(''); setBurn(false); })
        .catch((e: any) => showAlert('Could not send', e?.message ?? 'Try again.'))
        .finally(() => setBurnSending(false));
      return;
    }
    // Clear the box NOW, not on the server's answer. Waiting meant that
    // on a phone the same sentence sat in the composer and in a bubble
    // below it for the length of the round-trip, and the send button
    // stayed disabled the whole time. If the send fails the text comes
    // back, so nothing is lost by clearing early.
    setDraft('');
    send.mutate(
      { threadId, body },
      {
        onError: (e: any) => {
          setDraft((d) => (d ? d : body));
          showAlert('Could not send', e?.message ?? 'Try again.');
        },
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
        <View style={[s.frame, { marginBottom: 12 }]}>
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.replace('/messages')}
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
          {thread?.status === 'open' && (
            <TouchableOpacity
              onPress={onStartCall}
              disabled={startCall.isPending}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Video call"
            >
              <Ionicons
                name="videocam-outline"
                size={22}
                color={startCall.isPending ? Colors.textMuted : Colors.textPrimary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Guests only: the one line about keeping this. */}
        <GuestKeepBar />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          // The reliable scroll signal: the content actually took its
          // final height. Fires after images size and the keyboard
          // settles, which the length-based timer above cannot see.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {timeline.map((it) => {
            if (it.kind === 'drop') {
              return (
                <DropBubble
                  key={`d-${it.d.id}`}
                  post={it.d}
                  mine={it.d.author_id === userId}
                  s={s}
                />
              );
            }
            const m = it.m;
            const isMine = m.sender_id === userId;
            return (
              <View key={m.id} style={[s.bubbleWrap, isMine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
                {/* In flight. The bubble is real and stays put; the half
                    tone is the only thing that says the server has not
                    answered yet. */}
                <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs, m.pending && s.bubbleUnsent]}>
                  <Text style={isMine ? s.bubbleTextMine : s.bubbleTextTheirs}>{m.body}</Text>
                </View>
                {!m.pending && <Text style={s.bubbleTime}>{relTime(m.created_at)}</Text>}
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
              <Button
                title="Decline"
                onPress={() => showConfirm(
                  'Decline this request?',
                  "They won't be able to send more messages.",
                  () => decline.mutate(thread.id, { onSuccess: () => router.replace('/messages') }),
                  'Decline', 'Cancel',
                )}
                variant="outline"
                size="sm"
                style={s.requestBtn}
              />
              <Button
                title="Accept"
                onPress={() => accept.mutate(thread.id)}
                variant="primary"
                size="sm"
                style={s.requestBtn}
              />
            </View>
          </View>
        ) : (
          <View style={s.composer}>
            {initiatorIntroSent && (
              <View style={s.awaitingHintInline} pointerEvents="none">
                <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                <Text style={s.awaitingHintText}>Awaiting their response…</Text>
              </View>
            )}
            <TextInput
              style={s.composerInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
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
            {/* The flame arms the burn for this send. Open threads only —
                a request conversation earns no special weapons. */}
            {thread.status === 'open' && (
              <TouchableOpacity
                onPress={() => setBurn((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="switch"
                accessibilityLabel="Burn after reading"
                accessibilityState={{ checked: burn }}
              >
                <Ionicons
                  name={burn ? 'flame' : 'flame-outline'}
                  size={20}
                  color={burn ? Colors.error : Colors.textMuted}
                />
              </TouchableOpacity>
            )}
            {/* M8: opt-in eye when the heuristic flags escalation. */}
            <ReframerEye visible={reframer.eyeVisible} onPress={reframer.open} />
            <TouchableOpacity
              style={[s.composerSend, burn && s.composerSendBurn, !draft.trim() && { opacity: 0.4 }]}
              onPress={submit}
              // NOT gated on send.isPending. One mutation instance backs
              // every send in the thread, so a slow round-trip locked the
              // button and swallowed the next message — worst exactly
              // where sends are slowest.
              disabled={!draft.trim() || burnSending}
            >
              <Ionicons name={burn ? 'flame' : 'send'} size={18} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

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
  // Constrained narrow column on desktop — chat reads better in a
  // mobile-width canvas than spread across a 1440px viewport.
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  // Card frame around the entire chat surface so messages live in
  // their own visual container rather than floating directly on the
  // wallpaper. Header / scroll / composer all sit inside this card.
  frame: ({
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.xs,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 6px 24px rgba(0,0,0,0.06)' } : {}),
  } as any),
  empty: { padding: 40, textAlign: 'center', color: Colors.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xxs },
  // 36 / radius 7 are avatar geometry — no size or radius token matches.
  avatar: {
    width: 36, height: 36, borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: Colors.onPrimary, fontSize: Type.ui.size, fontWeight: '700' },
  headerName: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  headerHandle: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 1 },

  scroll: { padding: Spacing.md, gap: 6, paddingBottom: Spacing.md },
  noMessages: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },

  bubbleWrap: { maxWidth: '78%' },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  // The 4px tail corner is bubble geometry — no Radius token is that tight.
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleUnsent: { opacity: 0.55 },
  bubbleTextMine: { color: Colors.onPrimary, fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight },
  bubbleTextTheirs: { color: Colors.textPrimary, fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 2, marginHorizontal: Spacing.xxs },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  composerInput: {
    flex: 1, backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: Type.ui.size, color: Colors.textPrimary, maxHeight: 100,
  },
  // 38 / radius 7 match the avatar geometry above, not a control token.
  composerSend: {
    width: 38, height: 38, borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  // Armed. The send button wears the burn so the state is unmissable
  // at the moment it matters.
  composerSendBurn: { backgroundColor: Colors.error },

  requestBar: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: Spacing.md, gap: 10,
  },
  requestText: { fontSize: Type.caption.size, color: Colors.textSecondary, textAlign: 'center' },
  requestRow: { flexDirection: 'row', gap: 10 },
  // Button supplies the fill, the border, the ink and the 44pt floor.
  requestBtn: { flex: 1, borderRadius: Radius.full },

  awaitingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.sm,
  },
  awaitingText: { fontSize: Type.caption.size, color: Colors.textMuted, textAlign: 'center', flexShrink: 1 },
  awaitingHintInline: {
    position: 'absolute', top: -22, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  awaitingHintText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
}); }

/**
 * One drop, rendered as a chat bubble.
 *
 * Three states. Sealed: addressed to you, burns on view, not yet opened —
 * one tap opens it, and that tap is the reading that burns it. Open: the
 * body, with a quiet mark saying what this reading costs. Burned: the
 * redaction — a bar of ink where the words were, because "a message was
 * here and now is not" is information the thread should keep. The author
 * sees their own drop until it burns; after that even they get the bar
 * (migration 074 wipes the body itself, there is nothing left to show).
 */
function DropBubble({ post, mine, s }: { post: any; mine: boolean; s: any }) {
  // A DEADDROP announcement in a DM is an X, same as in the feed.
  const huntCode = React.useMemo(() => {
    const m = (post.body ?? '').match(/^DEADDROP · ([A-Z0-9]{6,12})/);
    return m ? m[1] : null;
  }, [post.body]);
  const ds = makeDropStyles();
  const revealed = useRevealed(post.id);
  const openDrop = useOpenDrop();
  const burned = !!post.burned_at;
  // The opener reads from the session copy; everyone else reads ash.
  const revealedBody = useRevealedBody(post.id);
  const sealed = !!post.destruct_on_view && !mine && !burned && !revealed;
  const bodyText = post.body ?? (burned ? revealedBody : null);
  const photos = Array.isArray(post.media) ? post.media.length : 0;

  return (
    <View style={[s.bubbleWrap, mine ? s.bubbleWrapMine : s.bubbleWrapTheirs]}>
      <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
        {burned && !revealedBody ? (
          <>
            <View style={ds.redaction} accessibilityLabel="Redacted" />
            <Text style={ds.mark}>burned after reading</Text>
          </>
        ) : sealed ? (
          <TouchableOpacity
            onPress={() => openDrop(post.id, post.body)}
            activeOpacity={0.8}
            style={ds.sealedRow}
            accessibilityLabel="Open this drop. It burns after reading"
          >
            <Ionicons name="flame-outline" size={14} color={Colors.textSecondary} />
            <Text style={ds.sealedText}>Sealed. Opens once.</Text>
          </TouchableOpacity>
        ) : huntCode ? (
          // A deaddrop sent direct. X marks the spot here the same as it
          // does in the feed; the tap opens the run.
          <TouchableOpacity
            onPress={() => router.push(`/hunt/${huntCode}` as any)}
            activeOpacity={0.8}
            style={ds.xWrap}
            accessibilityLabel={`Deaddrop ${huntCode}`}
          >
            <Text style={ds.xMark}>✕</Text>
          </TouchableOpacity>
        ) : (
          <>
            {!!bodyText && (
              <Text style={mine ? s.bubbleTextMine : s.bubbleTextTheirs}>{bodyText}</Text>
            )}
            {photos > 0 && (
              <Text style={ds.mark}>{photos === 1 ? 'a photo' : `${photos} photos`} · in the feed</Text>
            )}
            {!!post.destruct_on_view && (
              <Text style={ds.mark}>{mine ? 'burns on view' : 'burns after this reading'}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function makeDropStyles() { return StyleSheet.create({
  // The width of a sentence that is no longer there.
  redaction: {
    height: 14, width: 140, maxWidth: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2, marginVertical: 2,
  },
  mark: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 4,
  },
  sealedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  xWrap: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  xMark: { fontSize: 34, lineHeight: 38, fontWeight: '800' as const, color: Colors.textPrimary },
  sealedText: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textSecondary, fontStyle: 'italic',
  },
}); }
