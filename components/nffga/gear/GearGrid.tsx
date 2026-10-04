/**
 * GearGrid — listings in even columns sized to the space available.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../../constants/design';
import type { GearListing } from '../../../lib/nffga/types';
import { GearCard } from './GearCard';

export function GearGrid({ items, maxColumns = 4 }: { items: GearListing[]; maxColumns?: number }) {
  const s = makeStyles();
  const [w, setW] = useState(0);
  const gap = Spacing.md;
  const cols = Math.max(2, Math.min(maxColumns, Math.floor((w + gap) / (180 + gap)) || 2));
  const cell = w > 0 ? Math.floor((w - gap * (cols - 1)) / cols) : undefined;
  return (
    <View style={s.grid} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && items.map((l) => <GearCard key={l.id} l={l} width={cell} />)}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, width: '100%' },
}); }
