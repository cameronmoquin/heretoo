/**
 * Start a new chat — contact picker.
 *
 * Lists everyone in the viewer's crew network (≤3 hops) so they can
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
import { Spacing, Radius, Type } from '../../constants/design';
import { Eyebrow } from '../../components/shared/Eyebrow';

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
      onSuccess: (thread) => router.replace(`/messages/${thread.id}`),
      onError: (e: any) => showAlert('Could not open chat', e?.message ?? 'Try again.'),
    });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.replace('/messages')}
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
          placeholder="Search"
          placeholderTextColor={Colors.textMuted}
          style={s.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        {filtered.length > 0 && (
          <Eyebrow style={s.sectionLabel}>From your network</Eyebrow>
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
            <Eyebrow style={s.sectionLabel}>By @handle</Eyebrow>
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
          </>
        )}

        {!showOutOfNetworkSearch && filtered.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={28} color={Colors.textMuted} />
            <Text style={s.emptyText}>Nobody to chat with yet.</Text>
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
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xxs },
  title: { flex: 1, textAlign: 'center', fontSize: Type.body.size, fontWeight: '700', color: Colors.textPrimary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    margin: Spacing.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  searchInput: { flex: 1, fontSize: Type.ui.size, color: Colors.textPrimary },

  list: { padding: Spacing.md, paddingTop: 0, gap: 6, maxWidth: 600, alignSelf: 'center', width: '100%' },
  // Type / color / tracking come from the shared Eyebrow.
  sectionLabel: { marginTop: Spacing.xs, marginBottom: Spacing.xxs },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.xs, borderRadius: 8,
  },
  // 40 / radius 7 are avatar geometry — no size or radius token matches.
  avatar: {
    width: 40, height: 40, borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: Colors.onPrimary, fontSize: 15, fontWeight: '700' },
  name: { fontSize: Type.ui.size, fontWeight: '600', color: Colors.textPrimary },
  handle: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 1 },

  outPill: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xxs, borderRadius: Radius.full,
  },
  outPillText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },

  empty: { color: Colors.textMuted, paddingVertical: Spacing.sm, textAlign: 'center', fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.xs },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
}); }
