/**
 * ThreadRow — one conversation in the inbox: the other person, the
 * last message, when, and an unread dot.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { Thread } from '../../../lib/nffga/types';
import { relativeTime } from '../../../lib/nffga/board';

export function ThreadRow({ thread }: { thread: Thread }) {
  const s = makeStyles();
  const name = thread.other?.display_name || 'Member';
  return (
    <Pressable
      onPress={() => router.push(`/inbox/${thread.id}` as any)}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`Conversation with ${name}${thread.unread ? ', unread' : ''}`}
    >
      <View style={s.dotCol}>{thread.unread ? <View style={s.dot} /> : null}</View>
      <View style={s.main}>
        <View style={s.top}>
          <Text style={[s.name, thread.unread && s.strong]} numberOfLines={1}>{name}</Text>
          <Text style={s.time}>{relativeTime(thread.last_message_at)}</Text>
        </View>
        {thread.subject ? <Text style={s.subject} numberOfLines={1}>{thread.subject}</Text> : null}
        <Text style={[s.preview, thread.unread && s.previewUnread]} numberOfLines={1}>
          {thread.last_message ?? ''}
        </Text>
      </View>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  row: {
    flexDirection: 'row', gap: Spacing.xs, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.surfaceAlt },
  dotCol: { width: 10, paddingTop: 6, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Colors.primary },
  main: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  name: {
    flex: 1, fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
    fontWeight: '500', color: Colors.textPrimary,
  },
  strong: { fontWeight: '700' },
  time: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  subject: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary },
  preview: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textMuted },
  previewUnread: { color: Colors.textPrimary },
}); }
