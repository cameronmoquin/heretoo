/**
 * Shared styles for the admin dashboard (components/nffga/admin/**).
 * Existing tokens only; colours read at render time via makeAdminStyles().
 */
import { StyleSheet, Platform } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';

export function makeAdminStyles() { return StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm,
  },
  h2: { fontSize: Type.title.size, lineHeight: Type.title.lineHeight, fontWeight: Type.title.weight, color: Colors.textPrimary },
  h3: { fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight, fontWeight: Type.cardTitle.weight, color: Colors.textPrimary },
  body: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
  muted: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
  secondary: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
  who: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  role: { fontSize: Type.caption.size, color: Colors.textSecondary, fontWeight: '600' },
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  inputReadOnly: { color: Colors.textSecondary, backgroundColor: Colors.surfaceAlt },
  ok: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  err: { fontSize: 13, color: Colors.error, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowEmail: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  rowMeta: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 2 },
  remove: { fontSize: 13, color: Colors.error, fontWeight: '600' },
  link: { fontSize: Type.ui.size, color: Colors.textSecondary, textDecorationLine: 'underline' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextOn: { color: Colors.onPrimary, fontWeight: '700' },
  badge: {
    minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: Radius.pill,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: Colors.onPrimary, fontSize: 12, fontWeight: '700' },
  section: { gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  grow: { flex: 1, minWidth: 0 },
}); }

export type AdminStyles = ReturnType<typeof makeAdminStyles>;
