/**
 * KonamiChimes — global keyboard easter egg.
 *
 * Type ↑↑↓↓←→←→ba (the Konami sequence, no Enter) anywhere on the
 * platform and the chime panel slides down from the top of the
 * viewport. Auto-dismisses on click outside.
 *
 * Mounted globally in the root layout. Native: returns null (the
 * Konami sequence is keyboard-only).
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Platform } from 'react-native';
import { ChimePanel } from './ChimePanel';

const SEQUENCE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

export function KonamiChimes() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      // Don't catch keystrokes inside text inputs — the user is typing.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        pos = 0;
        return;
      }
      const expected = SEQUENCE[pos];
      if (e.key === expected) {
        pos += 1;
        if (pos === SEQUENCE.length) {
          pos = 0;
          setOpen(true);
        }
      } else {
        // Allow restarting the sequence from the first key on a miss.
        pos = e.key === SEQUENCE[0] ? 1 : 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open || Platform.OS !== 'web') return null;

  return (
    <TouchableWithoutFeedback onPress={() => setOpen(false)}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <ChimePanel visible={open} onClose={() => setOpen(false)} />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  scrim: ({
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'flex-start',
    paddingTop: 80,
    zIndex: 9999,
  } as any),
  sheet: { width: '100%', maxWidth: 520, paddingHorizontal: 16 },
});
