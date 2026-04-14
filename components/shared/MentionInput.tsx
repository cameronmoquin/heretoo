import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, type TextInputProps } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/design';
import { Avatar } from './Avatar';

interface MentionUser {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MentionInputProps extends Omit<TextInputProps, 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  users: MentionUser[];
}

/**
 * TextInput that shows a dropdown of users when you type @.
 * Selecting a user inserts @username into the text.
 */
export function MentionInput({ value, onChangeText, users, style, ...rest }: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);

    // Check if user is typing @something
    const beforeCursor = text.slice(0, cursorPosition + (text.length - value.length));
    const lastAt = beforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const afterAt = beforeCursor.slice(lastAt + 1);
      // Only show if @ is at start or after a space, and no space after @
      const charBefore = lastAt > 0 ? beforeCursor[lastAt - 1] : ' ';
      if ((charBefore === ' ' || charBefore === '\n' || lastAt === 0) && !afterAt.includes(' ')) {
        setQuery(afterAt.toLowerCase());
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
  }, [value, cursorPosition, onChangeText]);

  const handleSelect = (user: MentionUser) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const lastAt = beforeCursor.lastIndexOf('@');
    const before = value.slice(0, lastAt);
    const after = value.slice(cursorPosition);
    const newText = `${before}@${user.username} ${after}`;
    onChangeText(newText);
    setShowSuggestions(false);
  };

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(query) ||
    (u.display_name?.toLowerCase().includes(query) ?? false)
  ).slice(0, 5);

  return (
    <View>
      {showSuggestions && filtered.length > 0 && (
        <View style={s.suggestions}>
          {filtered.map((user) => (
            <TouchableOpacity key={user.username} style={s.suggestion} onPress={() => handleSelect(user)}>
              <Avatar url={user.avatar_url} name={user.display_name} size={28} />
              <View>
                <Text style={s.sugName}>{user.display_name}</Text>
                <Text style={s.sugHandle}>@{user.username}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TextInput
        {...rest}
        style={[s.input, style]}
        value={value}
        onChangeText={handleChange}
        onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.end)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  suggestions: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: 4,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  sugName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  sugHandle: { fontSize: 11, color: Colors.textMuted },
});
