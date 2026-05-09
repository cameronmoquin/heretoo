/**
 * FamilyBillingBanner — calm subscription surface for the family
 * owner. Source of Truth, Milestone 12.
 *
 * Tone discipline:
 *   - The grandmother never sees a price (this banner only renders for
 *     the family owner / billing payer).
 *   - No "premium" badges, no upsell pushes.
 *   - Grace-period notice is one short line, no countdown timer.
 *   - One-tap upgrade CTA. One-tap manage. No retention dance.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFamilySubscription, useStartCheckout } from '../../hooks/useBilling';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  familyId: string;
  /** Only render for the family owner; pass false otherwise. */
  isOwner: boolean;
}

export function FamilyBillingBanner({ familyId, isOwner }: Props) {
  const s = makeStyles();
  const { data: sub, isLoading } = useFamilySubscription(familyId);
  const checkout = useStartCheckout();

  if (!isOwner) return null;
  if (isLoading) return null;

  // Memorial families — free forever, low-key acknowledgment.
  if (sub?.is_memorial) {
    return (
      <View style={[s.row, s.rowSubtle]}>
        <Ionicons name="leaf-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.subtle}>This family's plan is held free in memory.</Text>
      </View>
    );
  }

  // Grace period — failed payment, billing needs attention.
  if (sub && sub.in_grace) {
    return (
      <View style={[s.row, s.rowAlert]}>
        <Ionicons name="alert-circle-outline" size={14} color={Colors.warning ?? Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.alertTitle}>Billing needs attention.</Text>
          <Text style={s.alertBody}>The latest payment didn't go through. The family stays open for 30 days while you sort it out.</Text>
        </View>
        <TouchableOpacity
          onPress={() => onStart(sub.plan === 'annual' ? 'annual' : 'monthly')}
          style={s.alertBtn}
          activeOpacity={0.85}
        >
          <Text style={s.alertBtnText}>Update</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active paid plan — quiet acknowledgment.
  if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
    return (
      <View style={[s.row, s.rowSubtle]}>
        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.subtle}>
          On a {sub.plan === 'annual' ? 'yearly' : 'monthly'} plan
          {sub.current_period_end ? ` · renews ${formatDate(sub.current_period_end)}` : ''}
        </Text>
      </View>
    );
  }

  // No active subscription — one calm CTA. No exclamation, no scare.
  async function onStart(plan: 'monthly' | 'annual') {
    try {
      await checkout.mutateAsync({ familyId, plan });
    } catch (e: any) {
      showAlert('Could not start checkout', e?.message ?? 'Try again in a moment.');
    }
  }

  return (
    <View style={s.cta}>
      <Text style={s.ctaTitle}>Free for one family.</Text>
      <Text style={s.ctaBody}>
        Five dollars a month or fifty a year covers the family for everyone in it.
        The grandmother never sees the price.
      </Text>
      <View style={s.ctaActions}>
        <TouchableOpacity
          onPress={() => onStart('monthly')}
          style={s.ctaBtn}
          disabled={checkout.isPending}
          activeOpacity={0.85}
        >
          {checkout.isPending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={s.ctaBtnText}>$5 / month</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onStart('annual')}
          style={s.ctaBtnAlt}
          disabled={checkout.isPending}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnAltText}>$50 / year</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function makeStyles() { return StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginVertical: 6,
  },
  rowSubtle: { backgroundColor: Colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  rowAlert: {
    backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.warning ?? Colors.primary,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.lg,
    alignSelf: 'stretch',
  },
  subtle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  alertTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  alertBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginTop: 2 },
  alertBtn: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  alertBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  cta: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 6, marginVertical: 6,
  },
  ctaTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  ctaBody: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  ctaActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  ctaBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  ctaBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  ctaBtnAlt: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  ctaBtnAltText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
}); }
