/**
 * AdminDashboard — the back office at /admin, for SITE ADMINS only (the
 * super admin and the managing admin). app/admin.tsx decides whether to
 * render it; the database (migration 110, nffga_is_site_admin) is what
 * actually guards every read and write behind these tabs.
 *
 *   Requests  host-department event requests: approve → draft, decline
 *   Messages  Contact us inbox
 *   Photos    site photos, and member photo moderation
 *   Copy      editable website text
 *   Admins    designate / revoke seats (102)
 *   Account   own sign-in email and password
 *
 * Desktop: a left tab list. Phone: a horizontal tab row.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { hardSignOutAndRedirect } from '../../../lib/auth-recovery';
import { ROLE_LABEL, type AdminRole } from '../../../lib/admin';
import { useContactMessages } from '../../../lib/nffga/siteAdmin';
import { useAllEventRequests } from '../../../lib/nffga/tournaments';
import { Button } from '../../shared/Button';
import { BrandMark } from '../../shared/Logo';
import { Colors } from '../../../constants/colors';
import { Spacing, Radius, Type } from '../../../constants/design';
import { SITE_NAME } from '../../../constants/site';
import { EventRequestsPanel } from './EventRequestsPanel';
import { MessagesTab } from './MessagesTab';
import { PhotosTab } from './PhotosTab';
import { CopyTab } from './CopyTab';
import { AdminsTab } from './AdminsTab';
import { AccountTab } from './AccountTab';

type Tab = 'requests' | 'messages' | 'photos' | 'copy' | 'admins' | 'account';
const TABS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'messages', label: 'Messages' },
  { id: 'photos', label: 'Photos' },
  { id: 'copy', label: 'Copy' },
  { id: 'admins', label: 'Admins' },
  { id: 'account', label: 'Account' },
];

export function AdminDashboard({ email, role, cameByLink, onEmailChanged }: {
  email: string;
  role: AdminRole;
  cameByLink: boolean;
  onEmailChanged: (email: string) => void;
}) {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const wide = width >= 860;
  // Arriving by the emailed link means a password still needs setting.
  const [tab, setTab] = useState<Tab>(cameByLink ? 'account' : 'requests');

  const msgs = useContactMessages(true);
  const reqs = useAllEventRequests(true);
  const counts: Partial<Record<Tab, number>> = {
    messages: (msgs.data ?? []).filter((m) => m.status === 'new').length,
    requests: (reqs.data ?? []).filter((r) => r.status === 'submitted').length,
  };

  const tabButtons = TABS.map((t) => {
    const on = tab === t.id;
    const n = counts[t.id] ?? 0;
    return (
      <Pressable
        key={t.id}
        onPress={() => setTab(t.id)}
        style={[s.tab, wide ? s.tabWide : s.tabNarrow, on && s.tabOn]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={n ? `${t.label}, ${n} new` : t.label}
      >
        <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
        {n > 0 ? <View style={[s.badge, on && s.badgeOn]}><Text style={[s.badgeText, on && s.badgeTextOn]}>{n}</Text></View> : null}
      </Pressable>
    );
  });

  const content = (
    <>
      {tab === 'requests' ? <EventRequestsPanel /> : null}
      {tab === 'messages' ? <MessagesTab /> : null}
      {tab === 'photos' ? <PhotosTab /> : null}
      {tab === 'copy' ? <CopyTab /> : null}
      {tab === 'admins' ? <AdminsTab me={role} myEmail={email} /> : null}
      {tab === 'account' ? <AccountTab email={email} onEmailChanged={onEmailChanged} firstTime={cameByLink} /> : null}
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.bar}>
        <Pressable onPress={() => router.push('/' as any)} style={s.brand} accessibilityRole="link" accessibilityLabel={`${SITE_NAME} home`}>
          <BrandMark size={28} color={Colors.textPrimary} />
          <Text style={s.word}>{SITE_NAME}</Text>
          <Text style={s.barLabel}>Admin</Text>
        </Pressable>
        <View style={s.barActions}>
          <Button title="Back to site" onPress={() => router.push('/' as any)} variant="ghost" size="sm" />
          <Button title="Sign out" onPress={() => hardSignOutAndRedirect()} variant="outline" size="sm" />
        </View>
      </View>

      {wide ? (
        <View style={s.split}>
          <View style={s.side} accessibilityRole="tablist">
            {tabButtons}
            <View style={s.who}>
              <Text style={s.whoEmail} numberOfLines={1}>{email}</Text>
              <Text style={s.whoRole}>{ROLE_LABEL[role]}</Text>
            </View>
          </View>
          <ScrollView style={s.main} contentContainerStyle={s.mainInner} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </View>
      ) : (
        <View style={s.flex}>
          <View style={s.tabRowWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow} accessibilityRole="tablist">
              {tabButtons}
            </ScrollView>
          </View>
          <ScrollView style={s.flex} contentContainerStyle={s.mainInnerNarrow} keyboardShouldPersistTaps="handled">
            <Text style={s.whoRole}>{email} · {ROLE_LABEL[role]}</Text>
            {content}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  word: { fontSize: 16, fontWeight: '800', letterSpacing: 3, color: Colors.textPrimary },
  barLabel: { fontSize: Type.ui.size, color: Colors.textSecondary, fontWeight: '600' },
  barActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  split: { flex: 1, flexDirection: 'row' },
  side: {
    width: 220, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, gap: Spacing.xxs,
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  main: { flex: 1 },
  mainInner: { padding: Spacing.lg, gap: Spacing.md, maxWidth: 900, width: '100%', paddingBottom: Spacing.xxl },
  mainInnerNarrow: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  tabRowWrap: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRow: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: Spacing.xxs },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    borderRadius: Radius.control, minHeight: 40,
  },
  tabWide: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, justifyContent: 'space-between' },
  tabNarrow: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xxs },
  tabOn: { backgroundColor: Colors.primary },
  tabText: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary, fontWeight: '600' },
  tabTextOn: { color: Colors.onPrimary },
  badge: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: Radius.pill,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeOn: { backgroundColor: Colors.onPrimary },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.onPrimary },
  badgeTextOn: { color: Colors.primary },
  who: { marginTop: Spacing.lg, paddingHorizontal: Spacing.sm, gap: 2 },
  whoEmail: { fontSize: Type.caption.size, color: Colors.textPrimary, fontWeight: '600' },
  whoRole: { fontSize: Type.caption.size, color: Colors.textMuted },
}); }
