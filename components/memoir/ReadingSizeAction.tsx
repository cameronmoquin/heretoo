/**
 * ReadingSizeAction. The memoir's text-size toggle, sized for a header
 * actions slot. Bigger reading for the 65+ writer, no palette attached.
 * Selected state accents; the skin owns the color.
 */

import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { Gen } from '../../constants/generations';

interface ReadingSizeActionProps {
  large: boolean;
  onToggle: () => void;
}

export function ReadingSizeAction({ large, onToggle }: ReadingSizeActionProps) {
  const s = makeStyles();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Text size"
      accessibilityState={{ selected: large }}
      style={[s.btn, large && s.btnOn]}
    >
      <Text style={[s.label, large && s.labelOn]}>Aa</Text>
    </Pressable>
  );
}

function makeStyles() { return StyleSheet.create({
  btn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Gen.radius,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  label: {
    fontSize: Type.ui.size,
    fontWeight: '700',
    color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
  },
  labelOn: { color: Colors.primary },
}); }
