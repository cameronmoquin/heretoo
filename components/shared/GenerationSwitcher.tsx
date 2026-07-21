/**
 * GenerationSwitcher — pick the generation skin for the whole app.
 *
 * A free toggle: anyone can choose any cohort. Selecting one persists
 * it and remounts the app with that generation's palette + personality
 * (the root layout keys its remount on the generation). The chips
 * themselves recolour to the active generation, so the control previews
 * what you're choosing.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useGenerationStore } from '../../stores/generationStore';
import { GENERATIONS, GENERATION_ORDER } from '../../constants/generations';
import { Gen } from '../../constants/generations';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { GlitchText } from './GlitchText';

export function GenerationSwitcher() {
  const generation = useGenerationStore((s) => s.generation);
  const setGeneration = useGenerationStore((s) => s.setGeneration);
  const s = makeStyles();

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Look &amp; feel</Text>
      <View style={s.grid}>
        {GENERATION_ORDER.map((g) => {
          const t = GENERATIONS[g].tokens;
          const active = g === generation;
          const swatch = GENERATIONS[g].palette;
          return (
            <Pressable
              key={g}
              onPress={() => setGeneration(g)}
              style={[s.chip, active && s.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              {/* palette preview dots */}
              <View style={s.dots}>
                <View style={[s.dot, { backgroundColor: swatch.background }]} />
                <View style={[s.dot, { backgroundColor: swatch.primary }]} />
                <View style={[s.dot, { backgroundColor: swatch.heart }]} />
              </View>
              <Text style={[s.chipLabel, active && s.chipLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Live sample of the active generation's display treatment. */}
      <View style={s.sample}>
        <GlitchText style={s.sampleText}>HERETOO</GlitchText>
      </View>
    </View>
  );
}

function makeStyles() {
  const display = Platform.OS === 'web'
    ? ({ fontFamily: Gen.displayFont } as any)
    : {};
  return StyleSheet.create({
    wrap: { gap: 8 },
    label: {
      fontSize: 11, fontWeight: '700', color: Colors.textMuted,
      letterSpacing: 1.4, textTransform: 'uppercase',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minWidth: 96, flexGrow: 1, gap: 4,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: Math.max(6, Gen.radius),
      backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
    },
    chipActive: {
      borderColor: Colors.primary,
      backgroundColor: Colors.primaryFaint,
    },
    dots: { flexDirection: 'row', gap: 4, marginBottom: 2 },
    dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
    chipLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    chipLabelActive: { color: Colors.primary },
    sample: {
      marginTop: 6, padding: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: Colors.background,
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', gap: 4,
    },
    sampleText: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, ...display },
  });
}
