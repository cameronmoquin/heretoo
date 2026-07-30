/**
 * RailCard - the house card.
 *
 * The feed-rail treatment, generalized. Recessed onto Colors.background,
 * a hairline top rule, a colored left edge, corners from the skin. It
 * sinks into the page the way a wire story does. A person's post lifts.
 * This sinks.
 *
 * Give it an eyebrow to kick the section, an accentColor to set the left
 * edge and the kicker, an onPress to make it a button. Children carry
 * the content.
 */

import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { Gen } from '../../constants/generations';
import { Eyebrow } from './Eyebrow';

interface RailCardProps {
  children: React.ReactNode;
  /** Left edge + kicker color. Default Colors.primary. */
  accentColor?: string;
  /** Uppercase kicker rendered above the children. */
  eyebrow?: string;
  onPress?: () => void;
  /** Read to the user when onPress makes this a button. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function RailCard({
  children,
  accentColor,
  eyebrow,
  onPress,
  accessibilityLabel,
  style,
}: RailCardProps) {
  const accent = accentColor ?? Colors.primary;
  const s = makeStyles(accent);

  const inner = (
    <>
      <View style={s.rule} pointerEvents="none" />
      <View style={s.body}>
        {eyebrow ? <Eyebrow accentColor={accent}>{eyebrow}</Eyebrow> : null}
        {children}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[s.card, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={[s.card, style]}>{inner}</View>;
}

function makeStyles(accent: string) { return StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    borderRadius: Gen.radius,
    overflow: 'hidden',
    // Extra left padding clears the 3px edge.
    paddingLeft: Spacing.md + 3,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.md,
  },
  rule: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: accent,
  },
  body: { gap: Spacing.xs },
}); }
