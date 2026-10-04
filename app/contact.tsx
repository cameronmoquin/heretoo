/**
 * /contact — Contact Us. Public: works signed out.
 *
 * Posts to /api/contact (netlify/functions/contact.ts), which stores the
 * message for the site admins and emails them a "check your account"
 * notice. A hidden honeypot field catches simple bots.
 */
import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button } from '../components/shared/Button';
import { ErrorText, Notice, Page, PageTitle, Paragraph, TextField } from '../components/nffga/tournaments/ui';
import { SiteFooter } from '../components/nffga/SiteFooter';
import { Spacing } from '../constants/design';
import { SITE_URL } from '../constants/site';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/nffga/useSession';
import { useCopy } from '../lib/nffga/copy';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ContactScreen() {
  const s = makeStyles();
  const intro = useCopy('contact.intro');
  const { session, email: sessionEmail } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (sessionEmail && !email) setEmail(sessionEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEmail]);

  const send = async () => {
    setErr(null);
    if (!name.trim() || !email.trim() || !message.trim()) { setErr('Fill in your name, email and message.'); return; }
    if (!EMAIL_RE.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    try {
      const base = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : SITE_URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const res = await fetch(`${base}/api/contact`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), website }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) { setErr(body.error ?? 'Your message could not be sent. Try again later.'); return; }
      setDone(true);
    } catch {
      setErr('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow>
      <Stack.Screen options={{ title: 'Contact us' }} />
      <PageTitle title="Contact us" />
      <Paragraph>{intro}</Paragraph>

      {done ? (
        <View style={s.gap}>
          <Notice>Thanks. Your message was sent. An admin will reply by email.</Notice>
          <View style={s.row}>
            <Button title="Back to home" onPress={() => router.push('/' as any)} variant="outline" size="md" />
          </View>
        </View>
      ) : (
        <View style={s.gap}>
          <TextField label="Name" value={name} onChangeText={setName} required maxLength={120} autoCapitalize="words" />
          <TextField label="Email" value={email} onChangeText={setEmail} required maxLength={254}
            keyboardType="email-address" autoCapitalize="none" help="Where the reply will go." />
          <TextField label="Subject" value={subject} onChangeText={setSubject} maxLength={200} />
          <TextField label="Message" value={message} onChangeText={setMessage} required multiline={6} maxLength={5000} />

          {/* Honeypot: off-screen and hidden from assistive tech. People leave it empty. */}
          <View style={s.trap} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <TextInput value={website} onChangeText={setWebsite} placeholder="Website" autoComplete="off"
              {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as any) : {})} />
          </View>

          <ErrorText>{err}</ErrorText>
          <View style={s.row}>
            <Button title={busy ? 'Sending…' : 'Send message'} onPress={send} loading={busy} disabled={busy} variant="primary" size="lg" />
          </View>
        </View>
      )}
      <SiteFooter />
    </Page>
  );
}

function makeStyles() { return StyleSheet.create({
  gap: { gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  trap: { position: 'absolute', left: -10000, top: 0, width: 1, height: 1, overflow: 'hidden', opacity: 0 },
}); }
