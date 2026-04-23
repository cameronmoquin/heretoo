import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyGroups } from '../../../hooks/useFamilyGroups';
import { CandonColors } from '../../../constants/candon-theme';

export default function FamilyList() {
  const { data: groups, isLoading } = useFamilyGroups();

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.title}>Family</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.push('/candon/family/join')}
            >
              <Text style={s.secondaryBtnText}>Join</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => router.push('/candon/family/new')}
            >
              <Ionicons name="add" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && <ActivityIndicator color={CandonColors.primary} style={{ marginTop: 40 }} />}

        {!isLoading && (!groups || groups.length === 0) && (
          <View style={s.empty}>
            <Ionicons name="home-outline" size={36} color={CandonColors.textMuted} />
            <Text style={s.emptyTitle}>No family groups yet.</Text>
            <Text style={s.emptyText}>Create one or join with an invite code.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push('/candon/family/new')}
              >
                <Text style={s.emptyBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.emptyBtn, s.emptyBtnOutline]}
                onPress={() => router.push('/candon/family/join')}
              >
                <Text style={[s.emptyBtnText, { color: CandonColors.primary }]}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {groups?.map((g: any) => (
          <TouchableOpacity
            key={g.id}
            style={s.row}
            onPress={() => router.push(`/candon/family/${g.id}`)}
            activeOpacity={0.7}
          >
            <View style={s.iconBox}>
              <Ionicons name="home" size={20} color={CandonColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{g.name}</Text>
              <Text style={s.rowMeta}>{g.role === 'owner' ? 'You own this group' : `Member (${g.role})`}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={CandonColors.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: CandonColors.bg },
  scroll: { padding: 20, gap: 8, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: CandonColors.textPrimary },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: CandonColors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1, borderColor: CandonColors.border, backgroundColor: CandonColors.surface,
  },
  secondaryBtnText: { color: CandonColors.textPrimary, fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CandonColors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: CandonColors.border,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: CandonColors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: CandonColors.textPrimary },
  rowMeta: { fontSize: 12, color: CandonColors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: CandonColors.textPrimary, marginTop: 8 },
  emptyText: { fontSize: 14, color: CandonColors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: CandonColors.primary,
  },
  emptyBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: CandonColors.primary,
  },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
