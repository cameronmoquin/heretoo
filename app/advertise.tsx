/**
 * /advertise — the ad counter.
 *
 * Public. Anyone may apply; the artistic standard decides. A
 * submission is an application, not a purchase. Approval first,
 * payment after, so nobody buys past the aesthetic. Small business
 * only, by doctrine.
 *
 * THE PRICE IS THE AUDIENCE. A flat number would be a number with no
 * argument behind it. The rate is per hundred people who are actually
 * here, recomputed from heretoo_reach() in front of the person paying
 * it: no impressions, no per-person tracking, no dashboard, just the
 * honest count of the room. Small room, small price. When the room
 * grows, so does the rate, and nobody pays today for growth that has
 * not happened.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { showAlert } from '../lib/alert';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type, Heights } from '../constants/design';
import { Button } from '../components/shared/Button';
import { Eyebrow } from '../components/shared/Eyebrow';
import { HereTooLogo } from '../components/shared/Logo';

/** Dollars per hundred people, per month. The whole pricing model. */
const RATE_PER_HUNDRED = 20;
/** Below this the arithmetic is not worth an invoice. */
const FLOOR = 5;

function priceFor(reach: number): number {
  return Math.max(FLOOR, Math.round((reach / 100) * RATE_PER_HUNDRED));
}

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

  const { data: reach, isLoading: reachLoading } = useQuery({
    queryKey: ['heretoo-reach'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase.rpc('heretoo_reach');
      if (error) return null;
      return typeof data === 'number' ? data : null;
    },
  });

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

        {/* The price, computed in front of you from the only number
            that should set it. */}
        <View style={s.priceCard}>
          {reachLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : reach == null ? (
            <Text style={s.para}>
              ${RATE_PER_HUNDRED} for every hundred people here, per month.
            </Text>
          ) : (
            <>
              <Text style={s.priceBig}>${priceFor(reach)}</Text>
              <Text style={s.priceUnit}>a month</Text>
              <Text style={s.priceWhy}>
                There are {reach} people here today. The rate is $
                {RATE_PER_HUNDRED} for every hundred of them. When more
                arrive the price rises, and you are never charged for
                growth that has not happened yet.
              </Text>
            </>
          )}
        </View>

        <View style={s.deal}>
          <Text style={s.para}>
            Small businesses only. A jeweler, an Etsy shop, the ice-cream
            stand, not a corporation. Every ad is placed by hand and held to
            the same artistic standard as the gallery it hangs in. Most
            applications will be declined, and the standard is not
            negotiable.
          </Text>
          <Text style={s.para}>
            Targeting is three declared facts: age, gender identity, and
            location. Nothing else. No tracking, no pixels, no dashboard, no
            data going back to you. You are buying a place on the wall, the
            way the town paper sold one.
          </Text>
          <Text style={s.para}>
            Approval comes before payment, billing is by Stripe, and nothing
            is owed for applying.
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
  priceCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
    padding: Spacing.md, gap: 2, marginVertical: Spacing.xs,
  },
  priceBig: {
    fontSize: Type.hero.size, lineHeight: Type.hero.lineHeight,
    fontWeight: '800', color: Colors.textPrimary,
  },
  priceUnit: {
    fontSize: Type.ui.size, color: Colors.textSecondary, fontWeight: '600',
  },
  priceWhy: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight + 2,
    color: Colors.textSecondary, marginTop: Spacing.xs,
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
