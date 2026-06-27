/**
 * GlitchText — a generation-aware display heading.
 *
 * Applies the active generation's *display* treatment (font, transform,
 * letter-spacing) to any heading text, and — when the generation asks
 * for it (Gen Alpha's `glitch`) — a CRT chromatic-aberration glitch on
 * web. Native and non-glitch generations render clean styled text.
 *
 * Because the whole tree remounts when the generation changes (root
 * `key`), this re-reads the mutable `Gen` tokens on each render.
 */

import React from 'react';
import { Text, Platform, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { Gen } from '../../constants/generations';
import { Colors } from '../../constants/colors';

// One-time injection of the glitch keyframes (web only).
let glitchCssInjected = false;
function ensureGlitchCss() {
  if (glitchCssInjected || typeof document === 'undefined') return;
  glitchCssInjected = true;
  const el = document.createElement('style');
  el.setAttribute('data-ht', 'glitch');
  el.textContent =
    '@keyframes ht-glitch{0%,90%,100%{transform:translate(0,0)}' +
    '91%{transform:translate(-1px,0)}93%{transform:translate(1px,-1px)}' +
    '95%{transform:translate(-1px,1px)}97%{transform:translate(1px,0)}}';
  document.head.appendChild(el);
}

interface GlitchTextProps extends TextProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  /** Force-disable the glitch even on a glitch generation. */
  plain?: boolean;
}

export function GlitchText({ children, style, plain, ...rest }: GlitchTextProps) {
  const display: TextStyle = {
    ...(Platform.OS === 'web' ? ({ fontFamily: Gen.displayFont } as any) : {}),
    textTransform: Gen.displayTransform,
    letterSpacing: Gen.displayLetterSpacing,
  };

  const useGlitch = Gen.glitch && !plain && Platform.OS === 'web';
  if (useGlitch) {
    ensureGlitchCss();
    const glitch = {
      // Magenta/cyan split-channel shadow + a subtle position flicker.
      textShadow: `2px 0 ${Colors.heart}b3, -2px 0 ${Colors.primary}b3`,
      animation: 'ht-glitch 2.8s steps(1) infinite',
    } as any;
    return (
      <Text {...rest} style={[display as any, glitch, style]}>
        {children}
      </Text>
    );
  }

  return (
    <Text {...rest} style={[display, style]}>
      {children}
    </Text>
  );
}
