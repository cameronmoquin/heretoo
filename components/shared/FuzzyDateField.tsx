/**
 * FuzzyDateField - a date the author knows only in part.
 *
 * A year, a year and a month, or a full day. The precision toggle sets
 * how many inputs show. The value stays a set of parts; compose it to a
 * real 'YYYY-MM-DD' at save, padding the tail the author left blank.
 *
 * Lifted from the memoir timeline's inline date block so the babybook
 * and any later room share one date surface. The precision toggle runs
 * on the house Chip.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { Gen } from '../../constants/generations';
import { Chip } from './Chip';
import { Eyebrow } from './Eyebrow';

export type DatePrecision = 'year' | 'month' | 'day';

export interface DateParts {
  y: string;
  m: string;
  d: string;
  precision: DatePrecision;
}

export function emptyParts(): DateParts {
  return { y: '', m: '', d: '', precision: 'year' };
}

/** Compose a real 'YYYY-MM-DD' from the parts the author knows, padding
 *  the unknown tail. Null when no year. */
export function composeDate(dp: DateParts): string | null {
  if (!dp.y.trim()) return null;
  const yy = dp.y.trim().padStart(4, '0').slice(0, 4);
  if (dp.precision === 'year') return `${yy}-01-01`;
  const mm = (dp.m.trim() || '1').padStart(2, '0').slice(0, 2);
  if (dp.precision === 'month') return `${yy}-${mm}-01`;
  const dd = (dp.d.trim() || '1').padStart(2, '0').slice(0, 2);
  return `${yy}-${mm}-${dd}`;
}

/** Break a stored date string back into editable parts. */
export function partsOf(dateStr: string | null | undefined, precision: DatePrecision | null | undefined): DateParts {
  if (!dateStr) return { ...emptyParts(), precision: precision ?? 'year' };
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return { y: y ?? '', m: m ?? '', d: d ?? '', precision: precision ?? 'year' };
}

interface DateFieldProps {
  label: string;
  value: DateParts;
  onChange: (dp: DateParts) => void;
  compact?: boolean;
  style?: ViewStyle;
}

export function DateField({ label, value, onChange, compact, style }: DateFieldProps) {
  const s = makeStyles();
  const set = (patch: Partial<DateParts>) => onChange({ ...value, ...patch });
  const precisions: Array<{ p: DatePrecision; label: string }> = [
    { p: 'year', label: 'Year' },
    { p: 'month', label: 'Month' },
    { p: 'day', label: 'Day' },
  ];

  return (
    <View style={[s.field, style]}>
      <Eyebrow>{label}</Eyebrow>
      <View style={s.chips}>
        {precisions.map(({ p, label: pl }) => (
          <Chip key={p} label={pl} selected={value.precision === p} onPress={() => set({ precision: p })} />
        ))}
      </View>
      <View style={s.row}>
        <TextInput
          style={[s.input, { width: compact ? 66 : 84 }]}
          value={value.y}
          onChangeText={(t) => set({ y: t.replace(/[^0-9]/g, '') })}
          accessibilityLabel={`${label} year`}
          placeholder="Year"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
        />
        {value.precision !== 'year' && (
          <TextInput
            style={[s.input, { width: compact ? 52 : 64 }]}
            value={value.m}
            onChangeText={(t) => set({ m: t.replace(/[^0-9]/g, '') })}
            accessibilityLabel={`${label} month`}
            placeholder="Mo"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        )}
        {value.precision === 'day' && (
          <TextInput
            style={[s.input, { width: compact ? 52 : 64 }]}
            value={value.d}
            onChangeText={(t) => set({ d: t.replace(/[^0-9]/g, '') })}
            accessibilityLabel={`${label} day`}
            placeholder="Day"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
        )}
      </View>
    </View>
  );
}

function makeStyles() {
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: Gen.bodyFont } as any) : {};
  return StyleSheet.create({
    field: { gap: Spacing.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    row: { flexDirection: 'row', gap: Spacing.xs },
    input: {
      minHeight: 44,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      borderRadius: Gen.radius,
      backgroundColor: Colors.surface,
      borderWidth: 1,
      borderColor: Colors.border,
      fontSize: Type.ui.size,
      color: Colors.textPrimary,
      textAlign: 'center',
      ...bodyFont,
    },
  });
}
