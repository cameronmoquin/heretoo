/**
 * /admin — the association's back office, first version.
 *
 * Arriving here:
 *   - from the emailed sign-in link: the URL carries the session, which
 *     adoptSessionFromUrl() turns into a real one, and claim_admin_seat()
 *     seats the person (the link is what proves the inbox; see 102).
 *   - from the welcome page's password sign-in, already seated.
 *
 * Once seated:
 *   - SITE ADMINS (super admin, managing admin) get the dashboard
 *     (components/nffga/admin/Dashboard.tsx): event requests, Contact us
 *     messages, photos, website copy, admin seats, and their own account.
 *     Migration 110 enforces the same rule in the database
 *     (nffga_is_site_admin), so this branch is presentation only.
 *   - Every other officer seat sees its seat line, a plain note that the
 *     dashboard is not available to it, and the password card.
 *
 * The boot below (adopt the link session, claim the seat) is the
 * security-critical part and is unchanged: a seat is only ever claimed by
 * claim_admin_seat(), which requires an emailed-link session (102, 109).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { hardSignOutAndRedirect } from '../lib/auth-recovery';
import {
  adoptSessionFromUrl, claimAdminSeat, claimErrorText, ROLE_LABEL,
  type AdminRole,
} from '../lib/admin';
import { isSiteAdminRole, syncMyAdminEmail } from '../lib/nffga/siteAdmin';
import { AdminDashboard } from '../components/nffga/admin/Dashboard';
import { PasswordCard } from '../components/nffga/admin/PasswordCard';
import { Button } from '../components/shared/Button';
import { BrandLogo, BrandMark } from '../components/shared/Logo';
import { Eyebrow } from '../components/shared/Eyebrow';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type } from '../constants/design';
import { SITE_LONG_NAME } from '../constants/site';

type Phase = 'loading' | 'ready' | 'refused';

export default function AdminScreen() {
  const s = makeStyles();
  const [phase, setPhase] = useState<Phase>('loading');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<AdminRole | null>(null);
  const [cameByLink, setCameByLink] = useState(false);

  // ── Boot: adopt a link session, then claim or confirm the seat ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const adopted = await adoptSessionFromUrl();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        if (adopted.error) {
          setRefusal(`That sign-in link didn't work: ${adopted.error}. Request a new one.`);
          setPhase('refused');
        } else {
          router.replace('/(auth)/welcome' as any);
        }
        return;
      }
      setEmail(session.user.email ?? '');
      setCameByLink(adopted.adopted);
      const seat = await claimAdminSeat();
      if (cancelled) return;
      if (!seat.ok || !seat.role) {
        setRefusal(claimErrorText(seat.error));
        setPhase('refused');
        return;
      }
      setRole(seat.role);
      setPhase('ready');
      // Keep the designation row on the current sign-in email (110).
      void syncMyAdminEmail();
    })();
    return () => { cancelled = true; };
  }, []);

  if (phase === 'loading') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (phase === 'refused') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Header s={s} />
          <View style={s.card}>
            <Text style={s.body}>{refusal}</Text>
          </View>
          <Button title="Back to sign in" onPress={() => hardSignOutAndRedirect()} variant="primary" size="lg" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (role && isSiteAdminRole(role)) {
    return <AdminDashboard email={email} role={role} cameByLink={cameByLink} onEmailChanged={setEmail} />;
  }

  // Any other officer seat: the seat line and the password, no dashboard.
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Header s={s} />

        <View style={s.card}>
          <Eyebrow>Signed in</Eyebrow>
          <Text style={s.who}>{email}</Text>
          {role && <Text style={s.role}>{ROLE_LABEL[role]}</Text>}
          <Text style={s.body}>
            The admin dashboard is only available to the super admin and the managing admin. Your seat is recorded; there is nothing else to do here.
          </Text>
        </View>

        <PasswordCard firstTime={cameByLink} />

        <Button title="Back to site" onPress={() => router.push('/' as any)} variant="outline" size="lg" />
        <Button title="Sign out" onPress={() => hardSignOutAndRedirect()} variant="ghost" size="lg" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ s }: { s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.header}>
      <BrandMark size={56} color={Colors.textPrimary} />
      <BrandLogo size={40} color={Colors.textPrimary} />
      <Text style={s.sub}>{SITE_LONG_NAME}</Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl,
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  header: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm, marginTop: Spacing.md },
  sub: { fontSize: Type.caption.size, color: Colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm,
  },
  who: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  role: { fontSize: Type.caption.size, color: Colors.textSecondary, fontWeight: '600' },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
}); }
