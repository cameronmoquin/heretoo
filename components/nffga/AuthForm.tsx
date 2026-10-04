/**
 * AuthForm — the member sign-in and join form (/signin, /join).
 *
 * Join is email, password and a display name. The shared Supabase
 * project auto-confirms email, so a session comes back at once and the
 * member is returned to wherever they were (?next=). Admins use the
 * separate admin door, reached from /admin.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../shared/Button';
import { BrandMark } from '../shared/Logo';
import { Eyebrow } from '../shared/Eyebrow';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { useCopy } from '../../lib/nffga/copy';
import { signInMember, signUpMember, safeNext, signInHref, joinHref, requestEmailLink } from '../../lib/nffga/auth';

export function AuthForm({ mode }: { mode: 'signin' | 'join' }) {
  const s = makeStyles();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next);
  const joining = mode === 'join';
  const joinSub = useCopy('join.subtitle');
  const signinSub = useCopy('signin.subtitle');
  const subtitle = joining ? joinSub : signinSub;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const ready = email.trim() && password && (!joining || name.trim().length >= 2);

  const submit = async () => {
    setErr(null); setNote(null);
    if (joining && password.length < 8) { setErr('Use at least 8 characters for the password.'); return; }
    setBusy(true);
    const res = joining
      ? await signUpMember(email, password, name)
      : await signInMember(email, password);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    if ('needsConfirm' in res && res.needsConfirm) {
      setNote(`Check ${email.trim()} for a confirmation link, then sign in.`);
      return;
    }
    router.replace(next as any);
  };

  const forgot = async () => {
    setErr(null); setNote(null);
    if (!email.trim()) { setErr('Type your email first.'); return; }
    setBusy(true);
    const res = await requestEmailLink(email);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'Could not send the link.'); return; }
    setNote(`If ${email.trim()} has an account, a link to set a new password is on its way.`);
  };

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.push('/' as any)} style={s.brand} accessibilityRole="link" accessibilityLabel="NFFGA home">
        <BrandMark size={64} />
        <Text style={s.word}>NFFGA</Text>
      </Pressable>
      <Text style={[s.title, !!subtitle && s.titleTight]}>{joining ? 'Create your account' : 'Sign in'}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

      <View style={s.form}>
        {joining && (
          <>
            <Eyebrow>Name</Eyebrow>
            <TextInput
              style={s.input} value={name} onChangeText={setName}
              placeholder="How members will see you" placeholderTextColor={Colors.textMuted}
              autoComplete="name" maxLength={60}
            />
          </>
        )}
        <Eyebrow>Email</Eyebrow>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          placeholder="you@example.com" placeholderTextColor={Colors.textMuted}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
        />
        <Eyebrow>Password</Eyebrow>
        <View style={s.pwRow}>
          <TextInput
            style={[s.input, s.pwInput]} value={password} onChangeText={setPassword}
            secureTextEntry={!show}
            placeholder={joining ? 'At least 8 characters' : 'Password'} placeholderTextColor={Colors.textMuted}
            autoComplete={joining ? 'new-password' : 'current-password'}
            onSubmitEditing={ready ? submit : undefined}
          />
          <Pressable onPress={() => setShow((v) => !v)} style={s.eye} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {err && <Text style={s.err}>{err}</Text>}
        {note && <Text style={s.note}>{note}</Text>}

        <Button
          title={busy ? (joining ? 'Creating…' : 'Signing in…') : (joining ? 'Create account' : 'Sign in')}
          onPress={submit} loading={busy} disabled={busy || !ready} variant="primary" size="lg" style={s.submit}
        />
        {!joining && (
          <Pressable onPress={forgot} style={s.forgot}><Text style={s.link}>Forgot password? Email me a sign-in link</Text></Pressable>
        )}
        <Pressable
          onPress={() => router.replace((joining ? signInHref(params.next) : joinHref(params.next)) as any)}
          style={s.switch}
        >
          <Text style={s.link}>{joining ? 'Already a member? Sign in' : 'New here? Create an account'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles() { return StyleSheet.create({
  scroll: {
    flexGrow: 1, justifyContent: 'center', padding: Spacing.lg,
    maxWidth: 420, width: '100%', alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
  word: { fontSize: 22, fontWeight: '800', letterSpacing: 5, color: Colors.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.md },
  titleTight: { marginBottom: Spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.md },
  form: { gap: Spacing.xs },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: Spacing.sm, fontSize: 15, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  pwRow: { position: 'relative', justifyContent: 'center' },
  pwInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 12, height: '100%', justifyContent: 'center' },
  err: { color: Colors.error, fontSize: 13, lineHeight: 18, marginTop: Spacing.xxs },
  note: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: Spacing.xxs },
  submit: { marginTop: Spacing.sm, width: '100%' },
  forgot: { alignSelf: 'center', paddingVertical: Spacing.xs },
  switch: { alignSelf: 'center', paddingVertical: Spacing.xs },
  link: { fontSize: 14, color: Colors.textSecondary, textDecorationLine: 'underline' },
}); }
