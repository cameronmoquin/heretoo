/**
 * Network list page — every profile reachable through the family graph
 * (your families + their families, up to 3 hops).
 *
 * Each row shows the avatar / name / handle, with two quick actions:
 *   - "Profile"  → navigate to /u/<handle>
 *   - "Message"  → open or create a 1:1 thread with that profile
 *
 * Reached from the home-feed network pill ("X people in your network").
 * The pill used to dump people on /family, which doesn't actually
 * show the reachable individuals. This page does — and it's the right
 * jumping-off point for "I want to message Aunt Tess."
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyConnections } from '../../hooks/useFamily';
import { useOpenThread } from '../../hooks/useChat';
import { mediaPathToUrl } from '../../hooks/useUpload';
import { goBackToFeed } from '../../lib/nav';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function NetworkList() {
  const s = makeStyles();
  const { data: connections, isLoading } = useMyConnections();
  const openThread = useOpenThread();

  const startChat = (profileId: string) => {
    openThread.mutate(profileId, {
      onSuccess: (thread) => router.push(`/chat/${thread.id}` as any),
      onError: (e: any) => showAlert('Could not open chat', e?.message ?? 'Try again.'),
    });
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBackToFeed} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={s.title}>Your network</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : !connections || connections.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Nobody yet</Text>
            <Text style={s.emptySub}>
              Join or start a family to begin building your network. Anyone in your families — and anyone in theirs — shows up here, three hops deep.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.subhead}>
              {connections.length} {connections.length === 1 ? 'person' : 'people'} reachable through your families
            </Text>
            {connections.map((p) => (
              <View key={p.id} style={s.row}>
                <View style={s.avatar}>
                  {p.avatar_path ? (
                    <Image source={{ uri: mediaPathToUrl(p.avatar_path) }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.avatarTxt}>
                      {(p.display_name ?? p.handle ?? '?').slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={s.rowText}>
                  <Text style={s.rowName}>{p.display_name ?? p.handle ?? 'Unknown'}</Text>
                  {p.handle && <Text style={s.rowHandle}>@{p.handle}</Text>}
                </View>
                <View style={s.rowActions}>
                  {p.handle && (
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => router.push(`/u/${p.handle}` as any)}
                      activeOpacity={0.75}
                      accessibilityLabel="Visit profile"
                    >
                      <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                      <Text style={s.actionText}>Profile</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => startChat(p.id)}
                    disabled={openThread.isPending}
                    activeOpacity={0.75}
                    accessibilityLabel="Message"
                  >
                    <Ionicons name="chatbubble-outline" size={14} color="#FFF" />
                    <Text style={[s.actionText, { color: '#FFF' }]}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },

  scroll: { padding: Spacing.md, gap: 8 },
  subhead: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },

  empty: { padding: Spacing.lg, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', maxWidth: 320, lineHeight: 19 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderLight,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  rowHandle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionText: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
}); }
