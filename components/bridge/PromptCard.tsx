import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import type { BridgePrompt } from '../../hooks/useBridge';

interface PromptCardProps {
  prompt: BridgePrompt;
  isActive: boolean;
}

export function PromptCard({ prompt, isActive }: PromptCardProps) {
  return (
    <View
      style={[
        styles.container,
        isActive && styles.active,
      ]}
    >
      <Text style={styles.label}>
        Prompt {prompt.order}
      </Text>
      <Text style={[styles.text, isActive && styles.textActive]}>
        {prompt.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.6,
  },
  active: {
    opacity: 1,
    borderColor: Colors.bridge,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.bridge,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  text: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  textActive: {
    color: Colors.textPrimary,
  },
});
