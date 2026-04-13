import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import type { BridgeMessage } from '../../hooks/useBridge';

interface ConversationThreadProps {
  messages: BridgeMessage[];
}

export function ConversationThread({ messages }: ConversationThreadProps) {
  const userId = useAuthStore((s) => s.user?.id);

  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const isOwn = item.sender_id === userId;
        return (
          <View
            style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleOther,
            ]}
          >
            {item.prompt_id && (
              <Text style={styles.promptLabel}>responding to prompt</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isOwn ? styles.textOwn : styles.textOther,
              ]}
            >
              {item.content}
            </Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
    gap: 8,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  bubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceLight,
    borderBottomLeftRadius: 4,
  },
  promptLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  textOwn: {
    color: Colors.brandDark,
  },
  textOther: {
    color: Colors.textPrimary,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },
});
