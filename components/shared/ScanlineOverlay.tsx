/**
 * ScanlineOverlay — a CRT scanline + phosphor wash for glitch skins.
 *
 * Renders a fixed, click-through overlay on web when the active
 * generation asks for scanlines (Gen Alpha). It re-reads the mutable
 * Gen token on each render; the root remounts on generation change, so
 * switching skins adds or drops the overlay cleanly. Native renders
 * nothing.
 */

import React from 'react';
import { Platform } from 'react-native';
import { Gen } from '../../constants/generations';

export function ScanlineOverlay() {
  if (Platform.OS !== 'web' || !Gen.scanlines) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
        // Horizontal scanlines + a faint phosphor glow at the top.
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.16) 2px 3px),' +
          'radial-gradient(circle at 50% 0%, rgba(45,226,230,0.06), transparent 60%)',
        mixBlendMode: 'overlay',
      } as any}
    />
  );
}
