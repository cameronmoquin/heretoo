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
import { Button } from '../../components/shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

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
            <Text style={s.title}>{Vocab.GroupPlural}</Text>
          </View>
        </View>

        {isLoading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />}

        {!isLoading && familyCount === 0 && (
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Ionicons name="people-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={s.emptyTitle}>No {Vocab.group} yet.</Text>
            <View style={s.emptyBtnRow}>
              <Button
                title={`Start ${Vocab.groupWithArticle}`}
                onPress={() => router.push('/family/new')}
                style={s.ctaPill}
              />
              <Button
                title="I have a code"
                variant="ghost"
                onPress={() => router.push('/family/join')}
                style={s.ctaGhost}
              />
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
              <Text style={s.spinoffText}>Start another {Vocab.group}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl + Spacing.xs,
    gap: Spacing.xs, maxWidth: 600, alignSelf: 'center', width: '100%',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingVertical: 6, marginBottom: 6,
  },
  backBtnText: {
    fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight,
    color: Colors.textPrimary, fontWeight: '600',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  title: {
    fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
    fontWeight: Type.display.weight, letterSpacing: Type.display.letterSpacing,
    color: Colors.textPrimary, marginTop: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: Radius.xs,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: {
    fontSize: Type.bodyBold.size, fontWeight: '600', color: Colors.textPrimary,
  },
  rowMeta: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted, marginTop: 3,
  },
  spinoffRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, paddingHorizontal: 14,
    borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  spinoffText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 6, paddingHorizontal: 20 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: Radius.full,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.xxs,
  },
  emptyBtnRow: {
    flexDirection: 'row', gap: 10, marginTop: 20,
    flexWrap: 'wrap', justifyContent: 'center',
  },
  ctaPill: { borderRadius: Radius.full },
  ctaGhost: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary },
}); }
