import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  useBridgeMessages,
  useBridgeRealtime,
  useSendBridgeMessage,
} from '../../../hooks/useBridge';
import { ConversationThread } from '../../../components/bridge/ConversationThread';
import { PromptCard } from '../../../components/bridge/PromptCard';
import { Button } from '../../../components/shared/Button';
import { LoadingPulse } from '../../../components/shared/LoadingPulse';
import { Colors } from '../../../constants/colors';

const DEFAULT_PROMPTS = [
  { id: 'p1', text: 'What does your community value most?', order: 1 },
  { id: 'p2', text: 'What\'s something you wish the other side understood about your perspective?', order: 2 },
  { id: 'p3', text: 'Where do you think we might actually agree?', order: 3 },
];

export default function BridgeSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { data: messages, isLoading } = useBridgeMessages(sessionId);
  const sendMessage = useSendBridgeMessage();
  const [text, setText] = useState('');

  useBridgeRealtime(sessionId);

  // Determine active prompt based on message count
  const messageCount = messages?.length ?? 0;
  const activePromptIndex = Math.min(
    Math.floor(messageCount / 2),
    DEFAULT_PROMPTS.length - 1
  );

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage.mutate(
      {
        sessionId,
        content: text.trim(),
        promptId: DEFAULT_PROMPTS[activePromptIndex]?.id,
      },
      { onSuccess: () => setText('') }
    );
  };

  if (isLoading) return <LoadingPulse />;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Active prompt */}
        <View style={styles.promptArea}>
          <PromptCard
            prompt={DEFAULT_PROMPTS[activePromptIndex]}
            isActive={true}
          />
        </View>

        {/* Messages */}
        <View style={styles.messagesArea}>
          <ConversationThread messages={messages ?? []} />
        </View>

        {/* Input */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Share your perspective..."
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <Button
            title="Send"
            onPress={handleSend}
            loading={sendMessage.isPending}
            disabled={!text.trim()}
            size="sm"
          />
        </View>

        <Text style={styles.reminder}>
          48-hour window — thoughtful responses build trust
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  promptArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  messagesArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  reminder: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingBottom: 4,
  },
});
