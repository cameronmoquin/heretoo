/**
 * HoverTip — a small label that appears above a control on hover.
 *
 * Web only, and deliberately so: hover does not exist on a touch screen,
 * where a tip that needs a pointer would either never show or show on
 * every tap. On native the children render alone and the control's
 * accessibilityLabel carries the same words.
 *
 * NOT a general tooltip system. It says what a button does, in the same
 * words as its accessibility label, and nothing else. It is not a slot
 * for explanation.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/colors';

const WIDTH = 130;

export function HoverTip({
  label, children, style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  const [show, setShow] = useState(false);
  const s = makeStyles();

  if (Platform.OS !== 'web') return <>{children}</>;

  // RNW forwards mouse handlers to the DOM node; RN's types do not
  // declare them, hence the cast.
  const hover = {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
  } as any;

  return (
    <View style={[s.wrap, style]} {...hover}>
      {show && (
        <View style={s.bubble} pointerEvents="none">
          <Text style={s.text} numberOfLines={1}>{label}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  wrap: { position: 'relative' },
  bubble: {
    position: 'absolute',
    // Sits above the control. Centred by a fixed width and half of it
    // as a negative margin, which behaves the same on web and native
    // without relying on a percentage transform.
    bottom: '100%',
    left: '50%',
    width: WIDTH,
    marginLeft: -WIDTH / 2,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    zIndex: 50,
  },
  text: {
    color: Colors.surface,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
}); }
