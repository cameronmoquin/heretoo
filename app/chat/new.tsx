/**
 * Start a new chat — contact picker.
 *
 * Lists everyone in the viewer's family network (≤3 hops) so they can
 * tap one and land in a thread. People outside the network can be
 * reached via search (handle exact match) — the resulting thread will
 * be in 'pending' status until the recipient accepts.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useMyConnections } from '../../hooks/useFamily';
import { useOpenThread } from '../../hooks/useChat';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function NewChat() {
  const s = makeStyles();
  const [q, setQ] = useState('');
  const { data: connections } = useMyConnections();
  const open = useOpenThread();

  const filtered = useMemo(() => {
    const list = connections ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((c) =>
      (c.handle ?? '').toLowerCase().includes(needle) ||
      (c.display_name ?? '').toLowerCase().includes(needle),
    );
  }, [connections, q]);

  // Search-by-handle out-of-network fallback. Triggered when the user
  // types something that isn't in their connection list.
  const handleNeedle = q.trim().replace(/^@/, '').toLowerCase();
  const showOutOfNetworkSearch = handleNeedle.length >= 3 && filtered.length === 0;
  const { data: outOfNetwork, isFetching: searching } = useQuery({
    queryKey: ['profile-search', handleNeedle],
    queryFn: async () => {
      if (!showOutOfNetworkSearch) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, handle, display_name, avatar_path')
        .ilike('handle', `${handleNeedle}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: showOutOfNetworkSearch,
    staleTime: 30_000,
  });

  const startWith = (profileId: string) => {
    open.mutate(profileId, {
      onSuccess: (thread) => router.replace(`/chat/${thread.id}` as any),
      onError: (e: any) => showAlert('Could not open chat', e?.message ?? 'Try again.'),
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace('/chat' as any)}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>New chat</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or @handle"
          placeholderTextColor={Colors.textMuted}
          style={s.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {filtered.length > 0 && (
          <Text style={s.sectionLabel}>From your network</Text>
        )}
        {filtered.map((c) => (
          <ContactRow
            key={c.id}
            id={c.id}
            handle={c.handle}
            displayName={c.display_name}
            avatarPath={c.avatar_path}
            inNetwork
            onPress={() => startWith(c.id)}
          />
        ))}

        {showOutOfNetworkSearch && (
          <>
            <Text style={s.sectionLabel}>By @handle (outside your network)</Text>
            {searching && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />}
            {!searching && (outOfNetwork ?? []).map((p: any) => (
              <ContactRow
                key={p.id}
                id={p.id}
                handle={p.handle}
                displayName={p.display_name}
                avatarPath={p.avatar_path}
                inNetwork={false}
                onPress={() => startWith(p.id)}
              />
            ))}
            {!searching && (outOfNetwork ?? []).length === 0 && (
              <Text style={s.empty}>No matches.</Text>
            )}
            <Text style={s.fineprint}>
              Messages to people outside your family network start as a
              request — they'll choose to accept or decline before you can
              keep messaging.
            </Text>
          </>
        )}

        {!showOutOfNetworkSearch && filtered.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={28} color={Colors.textMuted} />
            <Text style={s.emptyText}>
              Nobody to chat with yet — join or build a family to grow your network.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({
  handle, displayName, avatarPath, inNetwork, onPress,
}: {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarPath: string | null;
  inNetwork: boolean;
  onPress: () => void;
}) {
  const s = makeStyles();
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={s.avatar}>
        {avatarPath ? (
          <Image source={{ uri: mediaPathToUrl(avatarPath) }} style={s.avatarImg} />
        ) : (
          <Text style={s.avatarText}>
            {(displayName ?? handle ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{displayName ?? handle ?? 'Unknown'}</Text>
        {!!handle && <Text style={s.handle}>@{handle}</Text>}
      </View>
      {!inNetwork && (
        <View style={s.outPill}>
          <Text style={s.outPillText}>Request</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: Spacing.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

  list: { padding: Spacing.md, paddingTop: 0, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 8, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#000', fontSize: 15, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  handle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  outPill: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  outPillText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },

  empty: { color: Colors.textMuted, paddingVertical: 12, textAlign: 'center', fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 19 },

  fineprint: {
    fontSize: 11, color: Colors.textMuted, marginTop: 8,
    paddingHorizontal: 4, lineHeight: 17,
  },
}); }
