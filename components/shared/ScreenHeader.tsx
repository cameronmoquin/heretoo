/**
 * ScreenHeader - a spare top row.
 *
 * A back chevron, a title, an actions slot. No chrome, no bespoke
 * per-screen header. The feed rails carry no header at all. Where a
 * screen needs one, this is it.
 *
 * Height floors at Heights.topHeader. Back defaults to router.back;
 * override with onBack. Title routes through Type.title and the skin's
 * display font on web.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Type, Heights } from '../../constants/design';
import { Gen } from '../../constants/generations';

interface ScreenHeaderProps {
  title?: string;
  /** Show the back chevron. */
  showBack?: boolean;
  /** Override the default router.back(). */
  onBack?: () => void;
  backLabel?: string;
  /** Right-side actions slot. Each action supplies its own accessibilityLabel. */
  right?: React.ReactNode;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  showBack,
  onBack,
  backLabel = 'Go back',
  right,
  style,
}: ScreenHeaderProps) {
  const s = makeStyles();
  return (
    <View style={[s.row, style]}>
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={s.back}
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
        </Pressable>
      ) : null}

      {!!title && (
        <Text style={s.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      )}

      <View style={s.spacer} />

      {right ? <View style={s.actions}>{right}</View> : null}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  row: {
    height: Heights.topHeader,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  back: { marginLeft: -4 },
  title: {
    fontSize: Type.title.size,
    lineHeight: Type.title.lineHeight,
    fontWeight: Type.title.weight,
    letterSpacing: Type.title.letterSpacing,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
  spacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
}); }
