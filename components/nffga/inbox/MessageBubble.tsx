/**
 * MessageBubble — one message. Mine sit right on the ink fill; theirs
 * sit left on the well.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import type { Message } from '../../../lib/nffga/types';
import { relativeTime } from '../../../lib/nffga/board';

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const s = makeStyles();
  return (
    <View style={[s.wrap, mine ? s.right : s.left]}>
      <View style={[s.bubble, mine ? s.mine : s.theirs]}>
        <Text style={[s.body, mine ? s.bodyMine : s.bodyTheirs]} selectable>{message.body}</Text>
      </View>
      <Text style={s.time}>{relativeTime(message.created_at)}</Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { maxWidth: '82%', gap: 2 },
  left: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.media },
  mine: { backgroundColor: Colors.primary },
  theirs: { backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  body: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight },
  bodyMine: { color: Colors.onPrimary },
  bodyTheirs: { color: Colors.textPrimary },
  time: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
}); }
