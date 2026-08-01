/**
 * /babybook. The shelf.
 *
 * One book per child. Each child is a rail card: name, age, cover. A
 * parent keeps as many as they have kids. Tap a card to open the book.
 *
 * The house card treatment (RailCard), the house header (ScreenHeader),
 * the house date field (FuzzyDateField) for the birth date. Mobile-first,
 * 393px.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Image as RNImage, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useBabybooks,
  useCreateBabybook,
  type Babybook,
} from '../../hooks/useBabybook';
import { getAssetDisplayUrl } from '../../hooks/useMemoir';
import { formatFuzzyDate } from '../../hooks/useMemoirTimeline';
import { goBack } from '../../lib/nav';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { Gen } from '../../constants/generations';
import { Button } from '../../components/shared/Button';
import { RailCard } from '../../components/shared/RailCard';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import {
  DateField, composeDate, emptyParts, type DateParts,
} from '../../components/shared/FuzzyDateField';

// Age at a glance. Days, then weeks, then months, then years.
function ageLabel(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  if (b.getTime() > now.getTime()) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.floor((now.getTime() - b.getTime()) / 86400000);
    if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} old`;
    const weeks = Math.floor(days / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} old`;
  }
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
}

export default function BabybookListScreen() {
  const s = makeStyles();
  const booksQ = useBabybooks();
  const createBook = useCreateBabybook();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<DateParts>(emptyParts());

  const reset = () => {
    setName('');
    setBirth(emptyParts());
    setAdding(false);
  };

  const onCreate = async () => {
    const n = name.trim();
    if (!n) {
      showAlert('Add a name', 'A book needs a name.');
      return;
    }
    const birthDate = composeDate(birth);
    try {
      const book = await createBook.mutateAsync({
        childName: n,
        birthDate,
        birthPrecision: birthDate ? birth.precision : null,
      });
      reset();
      router.push(`/babybook/${book.id}` as any);
    } catch (e: any) {
      showAlert('Could not create', e?.message ?? 'Try again.');
    }
  };

  const books = booksQ.data ?? [];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScreenHeader title="Babybook" showBack onBack={() => goBack()} backLabel="Back" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.addRow}>
          <Button
            title={adding ? 'Close' : 'Add a child'}
            variant="outline"
            size="sm"
            onPress={() => (adding ? reset() : setAdding(true))}
            icon={<Ionicons name={adding ? 'close' : 'add'} size={16} color={Colors.primary} />}
          />
        </View>

        {adding && (
          <RailCard eyebrow="New book">
            <View style={s.form}>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                accessibilityLabel="Child name"
                placeholder="Name"
                placeholderTextColor={Colors.textMuted}
              />
              <DateField label="Born" value={birth} onChange={setBirth} />
              <View style={s.formActions}>
                <Button title="Create" onPress={onCreate} loading={createBook.isPending} />
                <Button title="Cancel" variant="ghost" onPress={reset} />
              </View>
            </View>
          </RailCard>
        )}

        {books.length === 0 && !adding ? (
          <Text style={s.empty}>No books yet.</Text>
        ) : (
          <View style={s.list}>
            {books.map((b) => (
              <ChildCard key={b.id} book={b} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── One child, one card ────────────────────────────────────────────

function ChildCard({ book }: { book: Babybook }) {
  const s = makeStyles();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (book.cover_storage_path) {
      getAssetDisplayUrl(book.cover_storage_path).then((u) => { if (alive) setCover(u); });
    } else {
      setCover(null);
    }
    return () => { alive = false; };
  }, [book.cover_storage_path]);

  const age = ageLabel(book.birth_date);
  const born = formatFuzzyDate(book.birth_date, book.birth_precision);

  return (
    <RailCard
      eyebrow={age ?? 'New'}
      onPress={() => router.push(`/babybook/${book.id}` as any)}
      accessibilityLabel={`${book.child_name}. Open book.`}
    >
      <View style={s.childRow}>
        <View style={s.cover}>
          {cover ? (
            <RNImage source={{ uri: cover }} style={s.coverImg} resizeMode="cover" />
          ) : (
            <Ionicons name="happy-outline" size={24} color={Colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.childName}>{book.child_name}</Text>
          {!!born && <Text style={s.childSub}>{born}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
    </RailCard>
  );
}

function makeStyles() {
  const bodyFont = Platform.OS === 'web' ? ({ fontFamily: Gen.bodyFont } as any) : {};
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120, paddingTop: Spacing.sm, gap: Spacing.md },

    addRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xxs },

    form: { gap: Spacing.sm },
    input: {
      minHeight: 44, paddingHorizontal: Spacing.sm, paddingVertical: 10,
      borderRadius: Gen.radius, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: Type.ui.size, color: Colors.textPrimary, ...bodyFont,
    },
    formActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xxs },

    list: { gap: Spacing.sm },
    empty: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
      color: Colors.textSecondary, fontStyle: 'italic', marginTop: Spacing.lg, ...bodyFont,
    },

    childRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cover: {
      width: 52, height: 52, borderRadius: Gen.radius, overflow: 'hidden',
      backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    coverImg: { width: '100%', height: '100%' },
    childName: { fontSize: Type.cardTitle.size, fontWeight: '700', color: Colors.textPrimary, ...bodyFont },
    childSub: { fontSize: Type.caption.size, color: Colors.textSecondary, marginTop: 2, ...bodyFont },
  });
}
