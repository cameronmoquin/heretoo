/**
 * /give — always-on charitable donation surface.
 *
 * Built around the principle in the recipe document: HereToo runs no
 * advertising, but the platform CAN host a single calm always-on
 * donation flow where every dollar goes to ending homelessness in
 * America. The beneficiary is configured server-side (env var); this
 * page only handles the donor flow.
 *
 * Linked from a small "Give" affordance in the LeftSidebar and the
 * Room's side table. No popups, no exit-intent, no "donate now or
 * else" copy. The button is always there; nobody is ever pressured.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';

const PRESET_AMOUNTS = [5, 10, 25, 50];

export default function GiveScreen() {
  const s = makeStyles();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [totalCents, setTotalCents] = useState<number | null>(null);

  // Fetch the platform-wide running total (no donor names, just a
  // quiet number — "X dollars given so far across the platform.").
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('donation_total_cents');
        if (!cancelled && typeof data === 'number') setTotalCents(data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [status]);

  const onDonate = async () => {
    let cents: number;
    if (customAmount.trim()) {
      const dollars = parseFloat(customAmount);
      if (!Number.isFinite(dollars) || dollars < 1) {
        showAlert('Pick an amount', 'Enter at least one dollar.');
        return;
      }
      cents = Math.floor(dollars * 100);
    } else {
      cents = amount * 100;
    }

    setSubmitting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/donate-checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount_cents: cents,
          return_url: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Checkout failed (${res.status})`);
      }
      const j = (await res.json()) as { url: string };
      if (typeof window !== 'undefined' && j.url) {
        window.location.href = j.url;
      }
    } catch (e: any) {
      showAlert('Could not start donation', e?.message ?? 'Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        {status === 'success' ? (
          <View style={s.thanksWrap}>
            <Ionicons name="checkmark-circle" size={36} color={Colors.primary} />
            <Text style={s.thanksTitle}>Thank you.</Text>
            <Text style={s.thanksBody}>
              The receipt is on its way to your email.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/' as any)}
              style={s.btnGhost}
              activeOpacity={0.85}
            >
              <Text style={s.btnGhostText}>Back to the room</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={s.masthead}>
              <Eyebrow accentColor={Colors.primary} style={s.kicker}>Always on</Eyebrow>
              <Text style={s.title}>For the unhoused.</Text>
              <View style={s.flourishRow}>
                <View style={s.flourishRule} />
                <Text style={s.flourishGlyph}>✦</Text>
                <View style={s.flourishRule} />
              </View>
            </View>

            <View style={s.amountCard}>
              <Eyebrow>Choose an amount</Eyebrow>
              <View style={s.amountRow}>
                {PRESET_AMOUNTS.map((a) => {
                  const active = !customAmount && amount === a;
                  return (
                    <TouchableOpacity
                      key={a}
                      style={[s.amountBtn, active && s.amountBtnActive]}
                      onPress={() => { setAmount(a); setCustomAmount(''); }}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.amountBtnText, active && s.amountBtnTextActive]}>
                        ${a}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.customRow}>
                <Text style={s.customLabel}>Or enter another amount:</Text>
                <View style={s.customField}>
                  <Text style={s.customDollar}>$</Text>
                  <TextInput
                    style={s.customInput}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Button
                title="Give"
                onPress={onDonate}
                loading={submitting}
                variant="primary"
                size="lg"
                style={s.btnPrimary}
                textStyle={s.btnPrimaryText}
                icon={<Ionicons name="heart" size={16} color={Colors.onPrimary} />}
              />
            </View>

            {totalCents !== null && totalCents > 0 && (
              <Text style={s.total}>
                ${(totalCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} given through HereToo so far.
              </Text>
            )}

            <View style={s.about}>
              <Eyebrow>Where it goes</Eyebrow>
              <Text style={s.aboutBody}>
                Stripe processes the transaction. The full balance, minus the
                standard processing cost, is forwarded to the designated
                organization on a quarterly cadence. Receipts are emailed
                automatically.
              </Text>
              <TouchableOpacity
                style={s.transparencyLink}
                onPress={() => router.push('/give/transparency' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="receipt-outline" size={14} color={Colors.primary} />
                <Text style={s.transparencyLinkText}>See the transparency report</Text>
                <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center' },

  masthead: { gap: 14 },
  // Layout only; type / color / tracking come from the shared Eyebrow.
  kicker: { letterSpacing: 2.4 },
  // 50/56 sits well above Type.hero (44/48); snapping would drop the
  // masthead six points.
  title: {
    fontSize: 50, lineHeight: 56, fontWeight: '800', letterSpacing: -1.2,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  flourishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.xxs },
  flourishRule: { width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55 },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  amountCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.primary,
    gap: Spacing.md,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
  },
  amountRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  // Not the shared Chip: these flex across a grid and carry a 16px
  // amount, which Chip's shrink-wrapped 14px label cannot express.
  amountBtn: {
    flex: 1, minWidth: 70,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  amountBtnActive: {
    borderColor: Colors.primary, backgroundColor: Colors.primaryFaint,
  },
  amountBtnText: {
    fontSize: Type.body.size, fontWeight: '700', color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  amountBtnTextActive: { color: Colors.primary },

  customRow: { gap: 6 },
  customLabel: { fontSize: Type.caption.size, color: Colors.textMuted },
  customField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  customDollar: { fontSize: Type.body.size, color: Colors.textSecondary, fontWeight: '600' },
  customInput: {
    flex: 1, fontSize: Type.body.size, color: Colors.textPrimary, fontWeight: '600',
  },

  // Button supplies the fill, the ink, the spinner and the 44pt floor.
  btnPrimary: {
    gap: Spacing.xs,
    paddingVertical: 14,
    borderRadius: Radius.full,
    marginTop: Spacing.xxs,
  },
  btnPrimaryText: { fontWeight: '700', letterSpacing: 0.3 },

  total: {
    fontSize: 13, color: Colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', marginTop: Spacing.xxs,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  about: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: Spacing.xs,
  },
  aboutBody: {
    fontSize: Type.ui.size, lineHeight: 22, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  // Left hand-rolled: an outlined pill in the accent colour, which
  // Button's outline variant (neutral border, neutral ink) cannot express.
  transparencyLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  transparencyLinkText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  thanksWrap: { padding: Spacing.xl, gap: Spacing.md, alignItems: 'flex-start' },
  // 38 falls between Type.display (28) and Type.hero (44).
  thanksTitle: {
    fontSize: 38, fontWeight: '800', letterSpacing: -0.6, color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  thanksBody: {
    fontSize: Type.body.size, lineHeight: 26, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  // Same accent-outline shape as transparencyLink above.
  btnGhost: {
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
    marginTop: Spacing.sm,
  },
  btnGhostText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
}); }
