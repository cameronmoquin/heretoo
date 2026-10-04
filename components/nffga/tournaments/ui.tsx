/**
 * Small building blocks shared by the tournament and gear screens:
 * the page frame, form fields, chip pickers, and read-only rows.
 * Colours come from Colors at render time (makeStyles), per the theming
 * rule in constants/colors.ts.
 */
import React from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Pressable,
  type KeyboardTypeOptions, type ViewStyle,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type, Heights } from '../../../constants/design';
import { Chip } from '../../shared/Chip';

// ── Page ─────────────────────────────────────────────────────────────

export function Page({ children, narrow }: { children: React.ReactNode; narrow?: boolean }) {
  const s = makeStyles();
  return (
    <ScrollView style={s.page} contentContainerStyle={[s.content, narrow && s.narrow]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string | null; right?: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={s.titleRow}>
      <View style={s.titleText}>
        <Text style={s.title} accessibilityRole="header">{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right ? <View style={s.titleRight}>{right}</View> : null}
    </View>
  );
}

export function Loading() {
  const s = makeStyles();
  return <View style={s.center}><ActivityIndicator color={Colors.textMuted} /></View>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  const s = makeStyles();
  return <View style={s.notice}><Text style={s.noticeText}>{children}</Text></View>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  const s = makeStyles();
  if (!children) return null;
  return <Text style={s.error} accessibilityRole="alert">{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
  const s = makeStyles();
  return <Text style={[s.muted, style]}>{children}</Text>;
}

// ── Read-only sections ───────────────────────────────────────────────

export function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: ViewStyle }) {
  const s = makeStyles();
  return (
    <View style={[s.section, style]}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

/** A label/value row. Renders nothing when the value is empty. */
export function Row({ label, value, onPress }: { label: string; value?: string | number | null; onPress?: () => void }) {
  const s = makeStyles();
  if (value == null || value === '') return null;
  const v = <Text style={[s.rowValue, onPress && s.link]}>{String(value)}</Text>;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {onPress ? <Pressable onPress={onPress} accessibilityRole="link" style={s.rowValueWrap}>{v}</Pressable> : <View style={s.rowValueWrap}>{v}</View>}
    </View>
  );
}

export function Paragraph({ children }: { children?: string | null }) {
  const s = makeStyles();
  if (!children) return null;
  return <Text style={s.paragraph}>{children}</Text>;
}

// ── Form ─────────────────────────────────────────────────────────────

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={s.formSection}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      <View style={s.formBody}>{children}</View>
    </View>
  );
}

export function Field({ label, help, required, error, children }: {
  label: string; help?: string; required?: boolean; error?: string | null; children: React.ReactNode;
}) {
  const s = makeStyles();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}{required ? ' *' : ''}</Text>
      {children}
      {help ? <Text style={s.help}>{help}</Text> : null}
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function TextField({
  label, value, onChangeText, placeholder, help, required, multiline, keyboardType, error, maxLength,
  autoCapitalize, secure,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; help?: string;
  required?: boolean; multiline?: boolean | number; keyboardType?: KeyboardTypeOptions; error?: string | null;
  maxLength?: number; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; secure?: boolean;
}) {
  const s = makeStyles();
  const lines = typeof multiline === 'number' ? multiline : multiline ? 4 : 1;
  return (
    <Field label={label} help={help} required={required} error={error}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={[s.input, lines > 1 && { minHeight: 22 * lines + 20, textAlignVertical: 'top' }]}
        multiline={lines > 1}
        numberOfLines={lines > 1 ? lines : undefined}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secure}
        accessibilityLabel={label}
      />
    </Field>
  );
}

export function ChipPicker<T extends string | number>({
  label, options, value, onChange, labels, help, required, allowNone,
}: {
  label: string; options: readonly T[]; value: T | null; onChange: (v: T | null) => void;
  labels?: Partial<Record<T, string>>; help?: string; required?: boolean; allowNone?: boolean;
}) {
  const s = makeStyles();
  return (
    <Field label={label} help={help} required={required}>
      <View style={s.chips}>
        {options.map((o) => (
          <Chip
            key={String(o)}
            label={labels?.[o] ?? String(o)}
            selected={value === o}
            onPress={() => onChange(allowNone && value === o ? null : o)}
          />
        ))}
      </View>
    </Field>
  );
}

export function YesNo({ label, value, onChange, help, yes = 'Yes', no = 'No' }: {
  label: string; value: boolean; onChange: (v: boolean) => void; help?: string; yes?: string; no?: string;
}) {
  const s = makeStyles();
  return (
    <Field label={label} help={help}>
      <View style={s.chips}>
        <Chip label={yes} selected={value} onPress={() => onChange(true)} />
        <Chip label={no} selected={!value} onPress={() => onChange(false)} />
      </View>
    </Field>
  );
}

/** Two or three fields side by side on wide screens, stacked on narrow. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={s.fieldRow}>
      {React.Children.toArray(children).map((c, i) => <View key={i} style={s.fieldRowItem}>{c}</View>)}
    </View>
  );
}

// ── Parsing helpers for form values ──────────────────────────────────

export const blankToNull = (v: string): string | null => (v.trim() ? v.trim() : null);

/** "12.50" → 1250. Blank → null. Invalid → NaN. */
export function dollarsToCents(v: string): number | null {
  const t = v.replace(/[$,\s]/g, '');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(parseFloat(t) * 100);
}

export function centsToDollars(c: number | null | undefined): string {
  if (c == null) return '';
  return c % 100 ? (c / 100).toFixed(2) : String(c / 100);
}

/** Blank → null. Invalid → NaN. */
export function toNumber(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export const numToText = (n: number | null | undefined): string => (n == null ? '' : String(n));

function makeStyles() { return StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.md, paddingBottom: Spacing.xxl, gap: Spacing.lg,
    maxWidth: 1080, width: '100%', alignSelf: 'center',
  },
  narrow: { maxWidth: 760 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm },
  titleText: { flexShrink: 1, gap: Spacing.xxs },
  titleRight: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  title: { fontSize: Type.display.size, lineHeight: Type.display.lineHeight, fontWeight: Type.display.weight, color: Colors.textPrimary },
  sub: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  center: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  notice: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.media,
    padding: Spacing.md, backgroundColor: Colors.surfaceAlt,
  },
  noticeText: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  error: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.error },
  muted: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },

  section: { gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  sectionTitle: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  sectionBody: { gap: Spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingVertical: 2 },
  rowLabel: { width: 160, fontSize: Type.ui.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  rowValueWrap: { flex: 1, minWidth: 200 },
  rowValue: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  link: { textDecorationLine: 'underline' },
  paragraph: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },

  formSection: { gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  formBody: { gap: Spacing.md },
  field: { gap: Spacing.xxs + 2 },
  label: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  help: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
  fieldError: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.error },
  input: {
    minHeight: Heights.input, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  fieldRowItem: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
}); }
