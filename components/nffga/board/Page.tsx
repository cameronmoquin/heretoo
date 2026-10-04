/**
 * Page — the frame for the community screens: a ScrollView with a
 * centred 760 column. The global SiteHeader sits above it.
 * Also the small pieces those screens share: a page title, a field,
 * a muted line, an error line.
 */
import React from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, ActivityIndicator,
  type TextInputProps, type ScrollViewProps,
} from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { useSession } from '../../../lib/nffga/useSession';
import { RequireAccount } from '../RequireAccount';

export function Page({ title, children, scrollRef, ...rest }: {
  /** Browser tab title. */
  title?: string;
  children: React.ReactNode;
  scrollRef?: React.Ref<ScrollView>;
} & Pick<ScrollViewProps, 'refreshControl' | 'onContentSizeChange' | 'keyboardShouldPersistTaps'>) {
  const s = makeStyles();
  return (
    <ScrollView
      ref={scrollRef}
      style={s.page}
      contentContainerStyle={s.scroll}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {title ? <Stack.Screen options={{ title }} /> : null}
      <View style={s.column}>{children}</View>
    </ScrollView>
  );
}

/**
 * A members-only page. Signed in: the children. Signed out: the page
 * title and the account prompt, in the usual column.
 */
export function SignedInOnly({ title, reason, children }: { title: string; reason: string; children: React.ReactNode }) {
  const { session } = useSession();
  if (session) return <>{children}</>;
  return (
    <Page title={title}>
      <PageTitle>{title}</PageTitle>
      <RequireAccount reason={reason}>{null}</RequireAccount>
    </Page>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string | null }) {
  const s = makeStyles();
  return (
    <View style={s.titleWrap}>
      <Text style={s.title} accessibilityRole="header">{children}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

export function Field({ label, hint, style, ...input }: TextInputProps & { label: string; hint?: string }) {
  const s = makeStyles();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={Colors.textMuted}
        {...input}
        style={[s.input, input.multiline && s.multiline, input.editable === false && s.readOnly, style]}
        accessibilityLabel={label}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  const s = makeStyles();
  return <Text style={s.muted}>{children}</Text>;
}

export function ErrorLine({ children }: { children?: React.ReactNode }) {
  const s = makeStyles();
  if (!children) return null;
  return <Text style={s.error} accessibilityRole="alert">{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={Colors.textMuted} />
    </View>
  );
}

/** Shared input look, for screens that build their own TextInput. */
export function inputStyle() {
  return makeStyles().input;
}

function makeStyles() { return StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.xxl },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.md, gap: Spacing.md },
  titleWrap: { gap: Spacing.xxs },
  title: {
    fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight, color: Colors.textPrimary,
  },
  sub: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary },
  field: { gap: Spacing.xxs },
  label: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, fontWeight: '600', color: Colors.textPrimary },
  input: {
    minHeight: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  readOnly: { color: Colors.textSecondary },
  hint: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
  muted: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textMuted },
  error: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.error },
}); }
