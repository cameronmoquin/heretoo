/**
 * Chat — your direct-message threads.
 *
 * Layout:
 *   - Header with back button to /(tabs)/feed and a "New chat" button.
 *   - Open threads (status='open') as the main list.
 *   - "Requests" pile (status='pending', recipient is the viewer) — these
 *     are unsolicited messages from people more than 3 hops away in the
 *     crew graph; the viewer chooses to accept or decline before
 *     they can reply.
 *   - Tapping any row enters /messages/[threadId].
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOBILE_TAB_BAR_HEIGHT } from '../../components/shared/MobileTabBar';
import { shouldShowLeftSidebar } from '../../components/shared/LeftSidebar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThreads, type MessageThread } from '../../hooks/useChat';
import { goBackToFeed } from '../../lib/nav';
import { useAuthStore } from '../../stores/authStore';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';

export default function ChatList() {
  const s = makeStyles();
  const userId = useAuthStore((st) => st.user?.id);
  const { data: threads } = useThreads();
  const { width: vw } = useWindowDimensions();
  const tabBarOffset = shouldShowLeftSidebar(vw) ? 0 : MOBILE_TAB_BAR_HEIGHT;

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
      <View style={[s.frame, { marginBottom: 12 + tabBarOffset }]}>
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
          onPress={() => router.push('/messages/new')}
          style={s.newBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="create-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {requests.length > 0 && (
          <>
            <Eyebrow style={s.sectionLabel}>Requests · {requests.length}</Eyebrow>
            {requests.map((t) => <ThreadRow key={t.id} t={t} pending />)}
          </>
        )}

        {open.length > 0 ? (
          <>
            {requests.length > 0 && <Eyebrow style={s.sectionLabel}>Threads</Eyebrow>}
            {open.map((t) => <ThreadRow key={t.id} t={t} pending={false} />)}
          </>
        ) : (
          requests.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Button
                title="New chat"
                onPress={() => router.push('/messages/new')}
                variant="primary"
                size="sm"
                style={s.emptyBtn}
              />
            </View>
          )
        )}
      </ScrollView>
      </View>
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
      onPress={() => router.push(`/messages/${t.id}`)}
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
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  // Card frame so the threads list lives in its own visual container
  // on top of the wallpaper rather than floating thread-rows in space.
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: Spacing.xxs },
  backBtnText: { fontSize: Type.ui.size, color: Colors.textPrimary, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary },
  newBtn: { padding: Spacing.xxs },

  list: { padding: Spacing.md, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  // Type / color / tracking come from the shared Eyebrow.
  sectionLabel: { marginTop: Spacing.xs, marginBottom: Spacing.xxs },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  // 44 / radius 8 are avatar geometry — no size or radius token matches.
  avatar: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: Colors.onPrimary, fontSize: Type.body.size, fontWeight: '700' },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  rowName: { flex: 1, fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  rowTime: { fontSize: 11, color: Colors.textMuted },
  rowPreview: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  pendingPill: {
    backgroundColor: Colors.primaryFaint,
    paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xxs, borderRadius: Radius.full,
  },
  pendingPillText: { fontSize: 10, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: Spacing.xs,
  },
  emptyTitle: { fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary, marginTop: Spacing.xs },
  // Button supplies the fill, the ink and the 44pt floor.
  emptyBtn: { marginTop: Spacing.sm, paddingHorizontal: 18, borderRadius: Radius.full },
}); }
