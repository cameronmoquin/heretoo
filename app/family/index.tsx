import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMyFamilies } from '../../hooks/useFamily';
import { goBackToFeed } from '../../lib/nav';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function FamilyList() {
  const s = makeStyles();
  const qc = useQueryClient();
  useEffect(() => { qc.invalidateQueries({ queryKey: ['families'] }); }, [qc]);
  const { data: families, isLoading } = useMyFamilies();
  const familyCount = families?.length ?? 0;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => goBackToFeed()}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityLabel="Back to HereToo"
        >
          <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          <Text style={s.backBtnText}>HereToo</Text>
        </TouchableOpacity>
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>Your circles</Text>
            <Text style={s.title}>Family</Text>
          </View>
        </View>

        {isLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />}

        {!isLoading && familyCount === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="people-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>You're not in a family yet</Text>
            <Text style={s.emptyText}>
              Family groups are private. Start your own and invite people in,
              or join with a code from someone who invited you.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => router.push('/family/new')}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnText}>Start a family</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.primary }]}
                onPress={() => router.push('/family/join')}
                activeOpacity={0.7}
              >
                <Text style={[s.primaryBtnText, { color: Colors.primary }]}>I have a code</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isLoading && familyCount > 0 && (
          <View style={{ gap: 10 }}>
            {families!.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={s.row}
                onPress={() => router.push(`/family/${g.id}`)}
                activeOpacity={0.75}
              >
                <View style={s.iconBox}>
                  <Ionicons name="people" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{g.name}</Text>
                  {g.description ? (
                    <Text style={s.rowMeta} numberOfLines={1}>{g.description}</Text>
                  ) : null}
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

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 40,
    gap: 8, maxWidth: 600, alignSelf: 'center', width: '100%',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 6, marginBottom: 6,
  },
  backBtnText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  eyebrow: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
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
  rowMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
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
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 320, marginTop: 4 },
  primaryBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
}); }
