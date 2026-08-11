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
import { Copy } from '../constants/copy';

/** Fills {reach} and {rate} in the author's strings. */
function fill(s: string, vals: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? String(vals[k]) : m));
}
const C = Copy.advertise;

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
            {C.received}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <HereTooLogo size={56} />
        <Text style={s.title}>{C.title}</Text>

        {/* The price, computed in front of you from the only number
            that should set it. */}
        <View style={s.priceCard}>
          {reachLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : reach == null ? (
            <Text style={s.para}>
              {fill(C.priceFallback, { rate: RATE_PER_HUNDRED })}
            </Text>
          ) : (
            <>
              <Text style={s.priceBig}>${priceFor(reach)}</Text>
              <Text style={s.priceUnit}>{C.priceUnit}</Text>
              <Text style={s.priceWhy}>
                {fill(C.priceWhy, { reach, rate: RATE_PER_HUNDRED })}
              </Text>
            </>
          )}
        </View>

        {C.terms.length > 0 && (
          <View style={s.deal}>
            {C.terms.map((p, i) => (
              <Text key={i} style={s.para}>{p}</Text>
            ))}
          </View>
        )}

        <Eyebrow>{C.fieldBusiness}</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          maxLength={120}
        />

        <Eyebrow>{C.fieldEmail}</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Eyebrow>{C.fieldLink}</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Link"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          placeholder={C.placeholderLink}
          placeholderTextColor={Colors.textMuted}
        />

        <Eyebrow>{C.fieldPitch}</Eyebrow>
        <TextInput
          style={[s.input, s.pitchInput]}
          accessibilityLabel="The pitch"
          value={pitch}
          onChangeText={setPitch}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        <Eyebrow>{C.fieldTargeting}</Eyebrow>
        <View style={s.targetRow}>
          <TextInput
            style={[s.input, s.targetInput]}
            accessibilityLabel="Age"
            value={age}
            onChangeText={setAge}
            placeholder={C.placeholderAge}
            placeholderTextColor={Colors.textMuted}
            maxLength={40}
          />
          <TextInput
            style={[s.input, s.targetInput]}
            accessibilityLabel="Gender identity"
            value={gender}
            onChangeText={setGender}
            placeholder={C.placeholderGender}
            placeholderTextColor={Colors.textMuted}
            maxLength={40}
          />
        </View>
        <TextInput
          style={s.input}
          accessibilityLabel="Location"
          value={location}
          onChangeText={setLocation}
          placeholder={C.placeholderLocation}
          placeholderTextColor={Colors.textMuted}
          maxLength={80}
        />

        <Button
          title={sending ? C.submitting : C.submit}
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
