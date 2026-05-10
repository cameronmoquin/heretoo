/**
 * /give/transparency — public donation reporting.
 *
 * Shows the full math: total raised, total disbursed, pending
 * balance, and the itemized history of every disbursement to a
 * beneficiary. No donor names; just amounts, dates, and references.
 *
 * The platform owner records each disbursement at /give/admin
 * (gated by profile.is_donation_admin). The numbers here come from
 * a single security-definer RPC so the math always reconciles.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useTransparencyReport, useDisbursements, useIsDonationAdmin,
  type Disbursement,
} from '../../hooks/useDonationTransparency';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function TransparencyScreen() {
  const s = makeStyles();
  const { data: report, isLoading } = useTransparencyReport();
  const { data: list } = useDisbursements();
  const { data: isAdmin } = useIsDonationAdmin();

  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {isAdmin && (
            <TouchableOpacity
              style={s.adminBtn}
              onPress={() => router.push('/give/admin' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="settings-outline" size={14} color={Colors.primary} />
              <Text style={s.adminBtnText}>Record</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.masthead}>
          <Text style={s.kicker}>Donation transparency</Text>
          <Text style={s.title}>The math.</Text>
          <Text style={s.lede}>
            Every donation collected on HereToo and every dollar forwarded to
            the beneficiary, on one page. No donor names. No commentary.
          </Text>
          <View style={s.flourishRow}>
            <View style={s.flourishRule} />
            <Text style={s.flourishGlyph}>✦</Text>
            <View style={s.flourishRule} />
          </View>
        </View>

        {isLoading && !report && <ActivityIndicator color={Colors.primary} />}

        {report && (
          <View style={s.statRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Received</Text>
              <Text style={s.statValue}>{fmt(report.total_received_cents)}</Text>
              <Text style={s.statSub}>
                {report.donor_count} {report.donor_count === 1 ? 'donor' : 'donors'}
              </Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Disbursed</Text>
              <Text style={s.statValue}>{fmt(report.total_disbursed_cents)}</Text>
              <Text style={s.statSub}>
                {report.disbursement_count} {report.disbursement_count === 1 ? 'transfer' : 'transfers'}
              </Text>
            </View>
            <View style={[s.statCard, s.statCardAccent]}>
              <Text style={[s.statLabel, { color: Colors.primary }]}>Pending</Text>
              <Text style={[s.statValue, { color: Colors.primary }]}>{fmt(report.pending_cents)}</Text>
              <Text style={s.statSub}>not yet disbursed</Text>
            </View>
          </View>
        )}

        {report?.current_beneficiary && (
          <View style={s.benefit}>
            <Text style={s.benefitKicker}>Current beneficiary</Text>
            <Text style={s.benefitName}>{report.current_beneficiary}</Text>
            {report.last_disbursed_at && (
              <Text style={s.benefitSub}>
                Last forwarded {formatDate(report.last_disbursed_at)}
              </Text>
            )}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Disbursement history</Text>
          {(list ?? []).length === 0 ? (
            <Text style={s.emptyBody}>
              No disbursements recorded yet. Funds are forwarded on a quarterly
              cadence; they appear here once each transfer clears.
            </Text>
          ) : (
            (list ?? []).map((d) => <DisbursementRow key={d.id} d={d} />)
          )}
        </View>

        <Text style={s.footnote}>
          Donor identities are never disclosed in public reporting. Stripe
          processing fees (typically 2.9% + 30¢ per transaction) are deducted
          before disbursement, in line with industry norms. The platform takes
          no additional cut.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DisbursementRow({ d }: { d: Disbursement }) {
  const s = makeStyles();
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <Text style={s.rowDate}>{formatDate(d.disbursed_at)}</Text>
        <Text style={s.rowBeneficiary}>{d.beneficiary}</Text>
        {!!d.note && <Text style={s.rowNote}>{d.note}</Text>}
        {!!d.reference && <Text style={s.rowRef}>ref: {d.reference}</Text>}
      </View>
      <Text style={s.rowAmount}>
        ${(d.amount_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center' },

  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  adminBtnText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  masthead: { gap: 14 },
  kicker: {
    fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  title: {
    fontSize: 50, lineHeight: 56, fontWeight: '800', letterSpacing: -1.2,
    color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  lede: {
    fontSize: 17, lineHeight: 28, color: Colors.textSecondary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
  flourishRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  flourishRule: { width: 56, height: 1, backgroundColor: Colors.primary, opacity: 0.55 },
  flourishGlyph: { fontSize: 13, color: Colors.primary, opacity: 0.85 },

  statRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 130,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    gap: 4,
  },
  statCardAccent: { borderColor: Colors.primary, backgroundColor: 'rgba(201, 161, 75, 0.10)' },
  statLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.6, textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 28, fontWeight: '800', color: Colors.brandIvory, letterSpacing: -0.5,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  statSub: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  benefit: {
    padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: 'rgba(22, 22, 29, 0.5)',
    borderLeftWidth: 2, borderLeftColor: Colors.primary,
    gap: 4,
  },
  benefitKicker: {
    fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.6, textTransform: 'uppercase',
  },
  benefitName: {
    fontSize: 18, fontWeight: '700', color: Colors.brandIvory,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  benefitSub: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  section: { gap: 6 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4,
  },
  emptyBody: {
    fontSize: 14, lineHeight: 22, color: Colors.textSecondary, fontStyle: 'italic',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    marginBottom: 6,
  },
  rowLeft: { flex: 1, minWidth: 0, gap: 2 },
  rowDate: {
    fontSize: 11, color: Colors.textMuted, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700',
  },
  rowBeneficiary: { fontSize: 14, color: Colors.brandIvory, fontWeight: '700' },
  rowNote: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  rowRef: { fontSize: 10, color: Colors.textMuted },
  rowAmount: {
    fontSize: 22, fontWeight: '800', color: Colors.primary, letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },

  footnote: {
    fontSize: 11, lineHeight: 17, color: Colors.textMuted, fontStyle: 'italic',
    textAlign: 'center', paddingTop: Spacing.md,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Source Serif 4", Georgia, serif' } as any) : {}),
  },
}); }
