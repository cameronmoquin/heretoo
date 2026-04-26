import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyGroups } from '../../../hooks/useFamilyGroups';
import { CandonColors } from '../../../constants/candon-theme';
import { FamilyCrest } from '../../../components/candon/FamilyCrest';

const SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export default function FamilyList() {
  const qc = useQueryClient();
  // Force a fresh fetch every time the list opens — drops cached deleted
  // groups so users never tap into a ghost URL.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['candon-family-groups'] });
  }, [qc]);
  const { data: groups, isLoading } = useFamilyGroups();

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>Your circles</Text>
            <Text style={s.title}>Family</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push('/candon/family/join')}
              activeOpacity={0.7}
            >
              <Ionicons name="enter-outline" size={14} color={CandonColors.textPrimary} />
              <Text style={s.secondaryBtnText}>Join with code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 60 }} />}

        {!isLoading && (!groups || groups.length === 0) && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="home-outline" size={32} color={CandonColors.primary} />
            </View>
            <Text style={s.emptyTitle}>You're not in a family yet</Text>
            <Text style={s.emptyText}>
              Family groups grow by invitation. Ask someone you know for their group's invite
              code — once you're in, you can spin off a new family of your own.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/candon/family/join')}
                activeOpacity={0.8}
              >
                <Text style={s.emptyBtnText}>I have an invite code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.emptyBtn, s.emptyBtnOutline]}
                onPress={() => router.push('/candon/family/new')}
                activeOpacity={0.7}
              >
                <Text style={[s.emptyBtnText, { color: CandonColors.primary }]}>Start a family</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ gap: 10 }}>
          {groups?.map((g: any) => (
            <TouchableOpacity
              key={g.id}
              style={s.row}
              onPress={() => router.push(`/candon/family/${g.id}`)}
              activeOpacity={0.75}
            >
              <FamilyCrest
                seed={g.id}
                name={g.name}
                size={42}
                paletteIndex={g.crest_palette_index ?? undefined}
                division={(g.crest_division as any) ?? undefined}
                charge={(g.crest_charge as any) ?? undefined}
              />
              <View style={{ width: 4 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{g.name}</Text>
                <View style={s.rowMetaRow}>
                  {g.role === 'owner' ? (
                    <View style={[s.rolePill, { backgroundColor: CandonColors.primaryFaint }]}>
                      <Text style={[s.rolePillText, { color: CandonColors.primary }]}>Owner</Text>
                    </View>
                  ) : (
                    <View style={s.rolePill}>
                      <Text style={s.rolePillText}>{g.role}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={CandonColors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: {
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40,
    gap: 8, maxWidth: 600, alignSelf: 'center', width: '100%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11, color: CandonColors.textMuted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
  title: {
    fontSize: 30, fontWeight: '400', color: CandonColors.textPrimary,
    fontFamily: SERIF, marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: CandonColors.primary,
  },
  addBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: CandonColors.border,
    backgroundColor: CandonColors.surface,
  },
  secondaryBtnText: { color: CandonColors.textPrimary, fontWeight: '600', fontSize: 13 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CandonColors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: CandonColors.border,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(60, 50, 30, 0.04)' as any },
      default: {},
    }),
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 17, fontWeight: '600', color: CandonColors.textPrimary,
    fontFamily: SERIF,
  },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    backgroundColor: CandonColors.surfaceRaise,
  },
  rolePillText: {
    fontSize: 10, fontWeight: '700', color: CandonColors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 6, paddingHorizontal: 20 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22, fontWeight: '400', color: CandonColors.textPrimary,
    marginTop: 4, fontFamily: SERIF,
  },
  emptyText: {
    fontSize: 14, color: CandonColors.textSecondary, textAlign: 'center',
    lineHeight: 21, maxWidth: 320, marginTop: 4,
  },
  emptyBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: CandonColors.primary,
  },
  emptyBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: CandonColors.primary,
  },
  emptyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});
