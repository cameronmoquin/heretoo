import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyGroups } from '../../hooks/useFamily';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function FamilyList() {
  const qc = useQueryClient();
  // Re-fetch on every open so deleted groups never persist in cache.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['family-groups'] });
  }, [qc]);

  const { data: groups, isLoading } = useFamilyGroups();
  const familyCount = groups?.length ?? 0;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>Your circles</Text>
            <Text style={s.title}>Family</Text>
          </View>
          <TouchableOpacity
            style={s.joinBtn}
            onPress={() => router.push('/family/join')}
            activeOpacity={0.7}
          >
            <Ionicons name="enter-outline" size={14} color={Colors.textPrimary} />
            <Text style={s.joinBtnText}>Join with code</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />}

        {!isLoading && familyCount === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="people-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>You're not in a family yet</Text>
            <Text style={s.emptyText}>
              Family groups are private. Use an invite code from someone you know,
              or start your own and invite people in.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.push('/family/join')}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>I have an invite code</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.outlineBtn}
                onPress={() => router.push('/family/new')}
                activeOpacity={0.7}
              >
                <Text style={s.outlineBtnText}>Start a family</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isLoading && familyCount > 0 && (
          <View style={{ gap: 10 }}>
            {groups!.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[s.row, !!g.theme_primary && { borderLeftWidth: 4, borderLeftColor: g.theme_primary }]}
                onPress={() => router.push(`/family/${g.id}`)}
                activeOpacity={0.75}
              >
                <View style={s.iconBox}>
                  <Ionicons name="people" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{g.name}</Text>
                  {g.motto ? (
                    <Text style={s.rowMotto}>{g.motto}</Text>
                  ) : (
                    <View style={s.rowMetaRow}>
                      <View style={s.rolePill}>
                        <Text style={s.rolePillText}>{g.role}</Text>
                      </View>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.spinoffRow}
              onPress={() => router.push('/family/new')}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={s.spinoffText}>Start another family</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40,
    gap: 8, maxWidth: 600, alignSelf: 'center', width: '100%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  eyebrow: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  joinBtnText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  rowMotto: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: 3 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rolePill: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    backgroundColor: Colors.background,
  },
  rolePillText: {
    fontSize: 10, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  spinoffRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  spinoffText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 6, paddingHorizontal: 20 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.textPrimary, marginTop: 4 },
  emptyText: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, maxWidth: 320, marginTop: 4,
  },
  primaryBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  outlineBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary,
  },
  outlineBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
