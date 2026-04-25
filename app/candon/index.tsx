import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { useContacts } from '../../hooks/useContacts';
import { useFamilyGroups } from '../../hooks/useFamilyGroups';
import { CandonColors } from '../../constants/candon-theme';
import { supabase } from '../../lib/supabase';

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export default function CandonHome() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const { data: contacts } = useContacts();
  const { data: families } = useFamilyGroups();

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' as any });
    } catch {}
    // Nuke any cached Supabase tokens — they survive plain signOut on web sometimes
    try {
      if (typeof window !== 'undefined') {
        const ls = window.localStorage;
        const ss = window.sessionStorage;
        Object.keys(ls).forEach((k) => {
          if (k.includes('supabase') || k.startsWith('sb-')) ls.removeItem(k);
        });
        Object.keys(ss).forEach((k) => {
          if (k.includes('supabase') || k.startsWith('sb-')) ss.removeItem(k);
        });
      }
    } catch {}
    reset();
    if (typeof window !== 'undefined') {
      window.location.href = '/candon';
    } else {
      router.replace('/candon');
    }
  };

  const name = profile?.display_name?.split(' ')[0] ?? 'there';
  const contactCount = contacts?.length ?? 0;
  const familyCount = families?.length ?? 0;

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const Card = ({
    icon, title, subtitle, count, onPress, accent,
  }: {
    icon: any; title: string; subtitle: string; count?: number;
    onPress: () => void; accent?: string;
  }) => (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.cardIcon, accent ? { backgroundColor: accent + '14' } : null]}>
        <Ionicons name={icon} size={20} color={accent ?? CandonColors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardSubtitle}>{subtitle}</Text>
      </View>
      {count !== undefined && count > 0 && (
        <View style={s.countPill}>
          <Text style={s.countPillText}>{count}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={CandonColors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Wordmark */}
        <View style={s.wordmarkRow}>
          <Text style={s.wordmark}>Candon</Text>
          <Text style={s.wordmarkDot}>·</Text>
          <Text style={s.wordmarkSub}>private correspondence</Text>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.heroName}>{name}.</Text>
          <Text style={s.heroSub}>
            A quieter place for the people you love most.
          </Text>
        </View>

        <View style={s.divider} />

        {/* Section label */}
        <Text style={s.sectionLabel}>Your circles</Text>

        <Card
          icon="home"
          title="Family"
          subtitle={
            familyCount === 0
              ? 'No groups yet — create one'
              : familyCount === 1
                ? 'One group'
                : `${familyCount} groups`
          }
          count={familyCount}
          onPress={() => router.push('/candon/family')}
        />

        <Card
          icon="people"
          title="Contacts"
          subtitle={
            contactCount === 0
              ? 'No contacts yet'
              : `${contactCount} ${contactCount === 1 ? 'person' : 'people'}`
          }
          count={contactCount}
          accent={CandonColors.warm}
          onPress={() => router.push('/candon/contacts')}
        />

        {/* Coming soon */}
        <Text style={[s.sectionLabel, { marginTop: 28 }]}>Coming soon</Text>
        <View style={s.soonGrid}>
          <View style={s.soonChip}>
            <Ionicons name="mail-outline" size={14} color={CandonColors.textSecondary} />
            <Text style={s.soonText}>Daily queue</Text>
          </View>
          <View style={s.soonChip}>
            <Ionicons name="archive-outline" size={14} color={CandonColors.textSecondary} />
            <Text style={s.soonText}>Reservoir</Text>
          </View>
          <View style={s.soonChip}>
            <Ionicons name="create-outline" size={14} color={CandonColors.textSecondary} />
            <Text style={s.soonText}>Drafts</Text>
          </View>
          <View style={s.soonChip}>
            <Ionicons name="sparkles-outline" size={14} color={CandonColors.textSecondary} />
            <Text style={s.soonText}>Refinement</Text>
          </View>
        </View>

        {/* Account footer */}
        {user && (
          <View style={s.acct}>
            <View style={s.acctRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {(user.email ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.acctName}>{profile?.display_name ?? user.email}</Text>
                <Text style={s.acctEmail}>{user.email}</Text>
              </View>
              <TouchableOpacity onPress={onSignOut} style={s.signOutBtn} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={15} color={CandonColors.textSecondary} />
                <Text style={s.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.footer}>Candon · for keeping in touch</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: {
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40,
    gap: 10, maxWidth: 600, alignSelf: 'center', width: '100%',
  },

  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  wordmark: {
    fontSize: 22, fontWeight: '700', color: CandonColors.primary,
    fontFamily: SERIF, letterSpacing: 0.5,
  },
  wordmarkDot: { color: CandonColors.textMuted, fontSize: 16 },
  wordmarkSub: {
    fontSize: 11, color: CandonColors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '500',
  },

  hero: { marginTop: 28, marginBottom: 8 },
  greeting: {
    fontSize: 14, color: CandonColors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 2, fontWeight: '600',
  },
  heroName: {
    fontSize: 38, lineHeight: 46, color: CandonColors.textPrimary,
    fontFamily: SERIF, fontWeight: '400', marginTop: 6,
  },
  heroSub: {
    fontSize: 15, lineHeight: 22, color: CandonColors.textSecondary,
    marginTop: 12, maxWidth: 380, fontStyle: 'italic',
  },

  divider: {
    height: 1, backgroundColor: CandonColors.border,
    marginVertical: 24, opacity: 0.7,
  },

  sectionLabel: {
    fontSize: 11, color: CandonColors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 10,
  },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CandonColors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: CandonColors.border,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(60, 50, 30, 0.04)' as any },
      default: {},
    }),
  },
  cardIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17, fontWeight: '600', color: CandonColors.textPrimary,
    fontFamily: SERIF,
  },
  cardSubtitle: { fontSize: 13, color: CandonColors.textSecondary, marginTop: 3 },
  countPill: {
    minWidth: 24, height: 22, paddingHorizontal: 8, borderRadius: 11,
    backgroundColor: CandonColors.surfaceRaise,
    alignItems: 'center', justifyContent: 'center',
  },
  countPillText: { fontSize: 12, fontWeight: '700', color: CandonColors.textSecondary },

  soonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: CandonColors.surfaceRaise,
    borderWidth: 1, borderColor: CandonColors.borderLight,
  },
  soonText: { fontSize: 12, color: CandonColors.textSecondary, fontWeight: '500' },

  acct: {
    marginTop: 36, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: CandonColors.borderLight,
  },
  acctRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: CandonColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '700', fontFamily: SERIF },
  acctName: { fontSize: 14, fontWeight: '600', color: CandonColors.textPrimary },
  acctEmail: { fontSize: 12, color: CandonColors.textMuted, marginTop: 1 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  signOutText: { fontSize: 12, color: CandonColors.textSecondary, fontWeight: '500' },

  footer: {
    marginTop: 32, fontSize: 11, color: CandonColors.textMuted,
    textAlign: 'center', letterSpacing: 0.5, fontStyle: 'italic',
  },
});
