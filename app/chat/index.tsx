/**
 * Chat — your direct-message threads.
 *
 * Layout:
 *   - Header with back button to /(tabs)/feed and a "New chat" button.
 *   - Open threads (status='open') as the main list.
 *   - "Requests" pile (status='pending', recipient is the viewer) — these
 *     are unsolicited messages from people more than 3 hops away in the
 *     family graph; the viewer chooses to accept or decline before
 *     they can reply.
 *   - Tapping any row enters /chat/[threadId].
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThreads, type MessageThread } from '../../hooks/useChat';
import { goBackToFeed } from '../../lib/nav';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function ChatList() {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const { data: threads } = useThreads();

  const { open, requests } = useMemo(() => {
    const all = threads ?? [];
    const open: MessageThread[] = [];
    const requests: MessageThread[] = [];
    for (const t of all) {
      if (t.status === 'declined') continue;
      if (t.status === 'pending' && t.initiator_id !== userId) {
        // Pending and the viewer is the recipient → it's a request.
        requests.push(t);
      } else {
        open.push(t);
      }
    }
    return { open, requests };
  }, [threads, userId]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => goBackToFeed()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          <Text style={s.backBtnText}>HereToo</Text>
        </TouchableOpacity>
        <Text style={s.title}>Messages</Text>
        <TouchableOpacity
          onPress={() => router.push('/chat/new' as any)}
          style={s.newBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {requests.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Requests · {requests.length}</Text>
            {requests.map((t) => <ThreadRow key={t.id} t={t} pending />)}
          </>
        )}

        {open.length > 0 ? (
          <>
            {requests.length > 0 && <Text style={s.sectionLabel}>Threads</Text>}
            {open.map((t) => <ThreadRow key={t.id} t={t} pending={false} />)}
          </>
        ) : (
          requests.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptySub}>
                Tap the pencil to start a chat with someone in your network.
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/chat/new' as any)}
              >
                <Text style={s.emptyBtnText}>New chat</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ThreadRow({ t, pending }: { t: MessageThread; pending: boolean }) {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const other = t.other;
  const lastBody = t.preview?.body ?? (pending ? 'Sent you a message request' : '');
  const lastIsMe = t.preview?.sender_id === userId;
  return (
    <TouchableOpacity
      style={s.row}
      onPress={() => router.push(`/chat/${t.id}` as any)}
      activeOpacity={0.75}
    >
      <View style={s.avatar}>
        {other?.avatar_path ? (
          <Image source={{ uri: mediaPathToUrl(other.avatar_path) }} style={s.avatarImg} />
        ) : (
          <Text style={s.avatarText}>
            {(other?.display_name ?? other?.handle ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>
            {other?.display_name ?? other?.handle ?? 'Unknown'}
          </Text>
          {!!t.last_message_at && (
            <Text style={s.rowTime}>{relTime(t.last_message_at)}</Text>
          )}
        </View>
        <Text style={s.rowPreview} numberOfLines={1}>
          {lastIsMe ? 'You: ' : ''}{lastBody}
        </Text>
      </View>
      {pending && (
        <View style={s.pendingPill}>
          <Text style={s.pendingPillText}>Request</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  backBtnText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  newBtn: { padding: 4 },

  list: { padding: Spacing.md, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 8, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  rowTime: { fontSize: 11, color: Colors.textMuted },
  rowPreview: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  pendingPill: {
    backgroundColor: Colors.primaryFaint,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  pendingPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
  emptyBtn: {
    marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13, letterSpacing: 0.1 },
}); }
