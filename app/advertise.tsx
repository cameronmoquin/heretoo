/**
 * /advertise — the ad counter.
 *
 * Public. Anyone may apply; the artistic standard decides. A
 * submission is an application, not a purchase — approval first,
 * payment after, so nobody buys past the aesthetic. Small business
 * only, by doctrine. Targeting is three declared slots: age, gender
 * identity, location. Newspaper advertising, not surveillance
 * advertising.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type, Heights } from '../constants/design';
import { Button } from '../components/shared/Button';
import { Eyebrow } from '../components/shared/Eyebrow';
import { HereTooLogo } from '../components/shared/Logo';

export default function AdvertiseScreen() {
  const s = makeStyles();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [pitch, setPitch] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const name = businessName.trim();
    const to = email.trim();
    const p = pitch.trim();
    if (name.length < 2) { showAlert('Name the business', 'Two characters at least.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { showAlert('Not an email address', 'Check it and try again.'); return; }
    if (p.length < 10) { showAlert('Write the pitch', 'A sentence at least.'); return; }
    setSending(true);
    try {
      const { error } = await supabase.from('ad_submissions').insert({
        business_name: name,
        contact_email: to,
        link: link.trim() || null,
        pitch: p,
        target_age: age.trim() || null,
        target_gender: gender.trim() || null,
        target_location: location.trim() || null,
      } as any);
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      showAlert('Could not submit', e?.message ?? 'Try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll}>
          <HereTooLogo size={56} />
          <Text style={s.para}>
            Received. If it passes the standard, you&apos;ll hear from us.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <HereTooLogo size={56} />
        <Text style={s.title}>Advertising</Text>

        <View style={s.deal}>
          <Text style={s.para}>
            Small businesses only. A jeweler, an Etsy shop, the ice-cream
            stand — not a corporation. Every ad is placed by hand and held to
            the same artistic standard as the gallery it hangs in; most
            applications will be declined, and the standard is not
            negotiable.
          </Text>
          <Text style={s.para}>
            Targeting is three declared facts — age, gender identity,
            location — and nothing else. No tracking. You get placement, the
            way the town paper sold it.
          </Text>
          <Text style={s.para}>
            $100 a month, flat. That is what a small Meta campaign costs —
            minus the algorithm, which we lack on purpose, and plus a
            curator, which they lack entirely. Approval comes before
            payment; billing is by Stripe, and nothing is owed for applying.
          </Text>
        </View>

        <Eyebrow>Business</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          maxLength={120}
        />

        <Eyebrow>Email</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Eyebrow>Where we can see your work</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Link"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          placeholder="https://"
          placeholderTextColor={Colors.textMuted}
        />

        <Eyebrow>The pitch</Eyebrow>
        <TextInput
          style={[s.input, s.pitchInput]}
          accessibilityLabel="The pitch"
          value={pitch}
          onChangeText={setPitch}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        <Eyebrow>Who it&apos;s for (each optional)</Eyebrow>
        <View style={s.targetRow}>
          <TextInput
            style={[s.input, s.targetInput]}
            accessibilityLabel="Age"
            value={age}
            onChangeText={setAge}
            placeholder="Age"
            placeholderTextColor={Colors.textMuted}
            maxLength={40}
          />
          <TextInput
            style={[s.input, s.targetInput]}
            accessibilityLabel="Gender identity"
            value={gender}
            onChangeText={setGender}
            placeholder="Gender identity"
            placeholderTextColor={Colors.textMuted}
            maxLength={40}
          />
        </View>
        <TextInput
          style={s.input}
          accessibilityLabel="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Location"
          placeholderTextColor={Colors.textMuted}
          maxLength={80}
        />

        <Button
          title={sending ? 'Sending' : 'Apply'}
          onPress={submit}
          loading={sending}
          size="lg"
          style={s.send}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.sm },
  title: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: '700', color: Colors.textPrimary, marginTop: 4,
  },
  deal: { gap: Spacing.sm, marginBottom: Spacing.sm },
  para: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight + 3,
    color: Colors.textPrimary,
  },
  input: {
    minHeight: Heights.input,
    padding: Spacing.sm, borderRadius: Radius.control,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1, borderColor: Colors.border,
    fontSize: 16, color: Colors.textPrimary,
  },
  pitchInput: { minHeight: 110 },
  targetRow: { flexDirection: 'row', gap: Spacing.sm },
  targetInput: { flex: 1 },
  send: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
}); }
