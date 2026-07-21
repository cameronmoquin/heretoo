/**
 * AdSlot — ad surface for the public square (the Loft).
 *
 * When an ad network is wired (Carbon Ads, Ethical Ads, or AdSense),
 * the inner content swaps for a real <ins> tag or iframe. The
 * container, sizing, and SPONSORED disclosure stay the same.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const LOFT = {
  bg: '#0E0E0E',
  surface: '#141414',
  border: '#2A2A2A',
  text: '#F5F5F5',
  muted: '#9A9A9A',
  accent: '#E0FF4F',
};

export function AdSlot() {
  return (
    <View style={s.wrap}>
      <View style={s.frame}>
        <Text style={s.kicker}>SPONSORED</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  frame: {
    padding: 14,
    borderRadius: 0,
    backgroundColor: LOFT.surface,
    borderWidth: 1, borderColor: LOFT.border,
    gap: 6,
  },
  kicker: {
    fontSize: 10, fontWeight: '700', color: LOFT.muted, letterSpacing: 2,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Inter", system-ui, sans-serif' } as any) : {}),
  },
});
