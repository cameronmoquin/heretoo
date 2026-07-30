/**
 * Chip - a selectable pill for filter and option rows.
 *
 * Default sits on Colors.surface. Selected fills primaryFaint and takes
 * the accent border and ink. Corners from the skin. Floors at the 44pt
 * touch target. Used for the insults tier and meter, reusable anywhere a
 * row of options needs a house tag.
 */

import React from 'react';
import { Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Type, Heights } from '../../constants/design';
import { Gen } from '../../constants/generations';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Selected border + ink color. Default Colors.primary. */
  accentColor?: string;
  style?: ViewStyle;
}

export function Chip({ label, selected, onPress, accentColor, style }: ChipProps) {
  const accent = accentColor ?? Colors.primary;
  const s = makeStyles(accent);
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, selected && s.chipSelected, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text style={[s.label, selected && s.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(accent: string) { return StyleSheet.create({
  chip: {
    minHeight: Heights.touchTarget,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Gen.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: Colors.primaryFaint,
    borderColor: accent,
  },
  label: {
    fontSize: Type.ui.size,
    lineHeight: Type.ui.lineHeight,
    fontWeight: '600',
    color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.bodyFont } as any) : {}),
  },
  labelSelected: { color: accent },
}); }
