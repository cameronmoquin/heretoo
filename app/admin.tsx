/**
 * /admin — the association's back office, first version.
 *
 * Arriving here:
 *   - from the emailed sign-in link: the URL carries the session, which
 *     adoptSessionFromUrl() turns into a real one, and claim_admin_seat()
 *     seats the person (the link is what proves the inbox; see 102).
 *   - from the welcome page's password sign-in, already seated.
 *
 * What it does today:
 *   - shows who you are and which seat you hold
 *   - sets or changes your password (the first-time step after the link)
 *   - for the super admin and the managing admin: adds and removes other
 *     admins and officers by email
 *
 * Tournaments and the gear trade will hang off this screen once their
 * tables are applied.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { hardSignOutAndRedirect } from '../lib/auth-recovery';
import {
  adoptSessionFromUrl, claimAdminSeat, claimErrorText, listAdmins, designateAdmin,
  revokeAdmin, canGrant, GRANTABLE_ROLES, ROLE_LABEL,
  type AdminRole, type AdminRow,
} from '../lib/admin';
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

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Header s={s} />

        <View style={s.card}>
          <Eyebrow>Signed in</Eyebrow>
          <Text style={s.who}>{email}</Text>
          {role && <Text style={s.role}>{ROLE_LABEL[role]}</Text>}
        </View>

        <PasswordCard s={s} firstTime={cameByLink} />

        {role && canGrant(role, 'admin') && <AdminsCard s={s} me={role} myEmail={email} />}

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

// ── Password ─────────────────────────────────────────────────────────

function PasswordCard({ s, firstTime }: { s: ReturnType<typeof makeStyles>; firstTime: boolean }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setMsg(null);
    if (pw.length < 8) { setMsg({ ok: false, text: 'Use at least 8 characters.' }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: "The two passwords don't match." }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(''); setPw2('');
    setMsg({ ok: true, text: 'Password saved. Next time, sign in with your email and this password.' });
  };

  return (
    <View style={s.card}>
      <Eyebrow>{firstTime ? 'Set your password' : 'Change password'}</Eyebrow>
      <TextInput
        style={s.input} value={pw} onChangeText={setPw} secureTextEntry
        placeholder="New password (8+)" placeholderTextColor={Colors.textMuted}
        autoComplete="new-password"
      />
      <TextInput
        style={s.input} value={pw2} onChangeText={setPw2} secureTextEntry
        placeholder="Type it again" placeholderTextColor={Colors.textMuted}
        autoComplete="new-password" onSubmitEditing={save}
      />
      {msg && <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text>}
      <Button title={busy ? 'Saving…' : 'Save password'} onPress={save} loading={busy} disabled={busy || !pw || !pw2} variant="primary" size="md" />
    </View>
  );
}

// ── Admins and officers ──────────────────────────────────────────────

function AdminsCard({ s, me, myEmail }: { s: ReturnType<typeof makeStyles>; me: AdminRole; myEmail: string }) {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>(me === 'super_admin' ? 'managing_admin' : 'admin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listAdmins()); setLoadErr(null); }
    catch (e: any) { setLoadErr(e?.message ?? 'Could not load the admin list.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grantable = GRANTABLE_ROLES.filter((r) => canGrant(me, r));

  const add = async () => {
    setMsg(null);
    const e = newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setMsg({ ok: false, text: 'Enter a full email address.' }); return; }
    setBusy(true);
    const res = await designateAdmin(e, newRole);
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: res.error === 'not_allowed' ? "You can't grant that role." : (res.error ?? 'Could not add.') }); return; }
    setNewEmail('');
    setMsg({ ok: true, text: `${e} added as ${ROLE_LABEL[newRole]}. Tell them to open this site, type that email, and tap "Email me a sign-in link".` });
    void load();
  };

  const remove = async (email: string) => {
    if (confirming !== email) { setConfirming(email); return; }
    setConfirming(null);
    const res = await revokeAdmin(email);
    if (!res.ok) { setMsg({ ok: false, text: res.error === 'not_allowed' ? "You can't remove that seat." : (res.error ?? 'Could not remove.') }); return; }
    void load();
  };

  return (
    <View style={s.card}>
      <Eyebrow>Admins and officers</Eyebrow>

      {loadErr && <Text style={s.err}>{loadErr}</Text>}
      {!rows && !loadErr && <ActivityIndicator color={Colors.primary} />}
      {rows?.map((r) => {
        const removable = r.email !== myEmail.toLowerCase() && canGrant(me, r.role);
        return (
          <View key={r.email} style={s.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowEmail} numberOfLines={1}>{r.email}</Text>
              <Text style={s.rowMeta}>
                {ROLE_LABEL[r.role]} · {r.claimed ? 'active' : 'invited, not signed in yet'}
              </Text>
            </View>
            {removable && (
              <TouchableOpacity onPress={() => remove(r.email)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.remove}>{confirming === r.email ? 'Confirm remove' : 'Remove'}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <View style={s.divider} />
      <Eyebrow>Add someone</Eyebrow>
      <TextInput
        style={s.input} value={newEmail} onChangeText={(t) => { setNewEmail(t); setMsg(null); }}
        placeholder="their@email.com" placeholderTextColor={Colors.textMuted}
        autoCapitalize="none" keyboardType="email-address" autoComplete="off"
      />
      <View style={s.chips}>
        {grantable.map((r) => (
          <TouchableOpacity
            key={r}
            style={[s.chip, newRole === r && s.chipOn]}
            onPress={() => setNewRole(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: newRole === r }}
          >
            <Text style={[s.chipText, newRole === r && s.chipTextOn]}>{ROLE_LABEL[r]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {msg && <Text style={msg.ok ? s.ok : s.err}>{msg.text}</Text>}
      <Button title={busy ? 'Adding…' : 'Add'} onPress={add} loading={busy} disabled={busy || !newEmail.trim()} variant="primary" size="md" />
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
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.sm,
    fontSize: 15, color: Colors.textPrimary,
  },
  ok: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  err: { fontSize: 13, color: Colors.error, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowEmail: { fontSize: 15, color: Colors.textPrimary, fontWeight: '600' },
  rowMeta: { fontSize: Type.caption.size, color: Colors.textMuted, marginTop: 2 },
  remove: { fontSize: 13, color: Colors.error, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextOn: { color: Colors.onPrimary, fontWeight: '700' },
}); }
