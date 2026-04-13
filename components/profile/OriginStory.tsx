import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface OriginStoryProps {
  story: string;
}

export function OriginStory({ story }: OriginStoryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Origin Story</Text>
      <Text style={styles.text}>{story}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  text: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});
