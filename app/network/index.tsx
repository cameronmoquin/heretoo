/**
 * Network list page — every profile reachable through the crew graph
 * (your crews + their crews, up to 3 hops).
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
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';

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
      <ScreenHeader title="Your network" showBack onBack={goBackToFeed} style={s.header} />

      <ScrollView contentContainerStyle={s.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : !connections || connections.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Nobody yet</Text>
          </View>
        ) : (
          <>
            <Text style={s.subhead}>
              {connections.length} {connections.length === 1 ? 'person' : 'people'}
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
                    <Ionicons name="chatbubble-outline" size={14} color={Colors.onPrimary} />
                    <Text style={[s.actionText, { color: Colors.onPrimary }]}>Message</Text>
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
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight,
  },

  scroll: { padding: Spacing.md, gap: Spacing.xs },
  subhead: { fontSize: Type.caption.size, color: Colors.textMuted, marginBottom: Spacing.xs },

  empty: { padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs },
  emptyTitle: {
    fontSize: Type.bodyBold.size, lineHeight: Type.bodyBold.lineHeight,
    fontWeight: Type.bodyBold.weight, color: Colors.textPrimary, marginTop: Spacing.xxs,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderLight,
  },
  avatar: {
    width: 40, height: 40, borderRadius: Radius.xs,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarTxt: { color: Colors.onPrimary, fontSize: Type.body.size, fontWeight: '700' },

  rowText: { flex: 1 },
  rowName: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    fontWeight: '600', color: Colors.textPrimary,
  },
  rowHandle: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 1 },

  rowActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionText: { fontSize: Type.eyebrow.size, fontWeight: '600', color: Colors.textPrimary },
}); }
