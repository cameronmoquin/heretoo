/**
 * /gear — the gear trade. Active listings in a grid, filtered by
 * category. Browsing needs no account; listing does.
 */
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button } from '../../components/shared/Button';
import { Chip } from '../../components/shared/Chip';
import { Spacing } from '../../constants/design';
import type { GearCategory } from '../../lib/nffga/types';
import { useSession } from '../../lib/nffga/useSession';
import { signInHref } from '../../lib/nffga/auth';
import { CATEGORY_LABEL, GEAR_CATEGORIES, useGearListings } from '../../lib/nffga/gear';
import { GearGrid } from '../../components/nffga/gear/GearGrid';
import { SitePhotoStrip } from '../../components/nffga/SitePhotoStrip';
import { useCopy } from '../../lib/nffga/copy';
import { Loading, Muted, Page, PageTitle } from '../../components/nffga/tournaments/ui';

export default function GearScreen() {
  const s = makeStyles();
  const { userId } = useSession();
  const [category, setCategory] = useState<GearCategory | null>(null);
  const q = useGearListings(category);
  const intro = useCopy('gear.intro');

  return (
    <Page>
      <Stack.Screen options={{ title: 'Gear trade' }} />
      <PageTitle
        title="Gear trade"
        sub={intro}
        right={<Button title="List gear" onPress={() => router.push((userId ? '/gear/new' : signInHref('/gear/new')) as any)} variant="primary" size="md" />}
      />
      <SitePhotoStrip placement="gear" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {GEAR_CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
      </ScrollView>
      {q.isLoading ? <Loading /> : (q.data ?? []).length === 0 ? (
        <Muted>{category ? `No ${CATEGORY_LABEL[category].toLowerCase()} listings right now.` : 'No gear listed yet.'}</Muted>
      ) : (
        <View><GearGrid items={q.data ?? []} /></View>
      )}
    </Page>
  );
}

function makeStyles() { return StyleSheet.create({
  chips: { gap: Spacing.xs, paddingBottom: Spacing.xxs },
}); }
