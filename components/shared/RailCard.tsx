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

// RETIRED AS A LOOK, kept as a shim — same reasoning as Eyebrow.
//
// UI_SYSTEM §5: a row, not a card. No fill, no radius, no left rail; one
// hairline along the bottom and that is the whole separation. The accent
// argument is accepted and ignored, because the coloured edge is the
// thing being retired.
function makeStyles(_accent: string) { return StyleSheet.create({
  card: {
    position: 'relative',
    // Was Colors.background with a radius and a 3px coloured left edge.
    // Rows sit on the canvas with no fill of their own.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  // The rail is gone. Kept as a zero-size no-op so the element RailCard
  // renders unconditionally does not need a second code path.
  rule: { width: 0, height: 0 },
  body: { gap: Spacing.xs },
}); }
