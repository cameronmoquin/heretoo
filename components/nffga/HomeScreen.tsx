/**
 * HomeScreen — what the QR code opens. Public: no sign-in to look around.
 *
 * The crest and the name, two doors (join, or look at tournaments), then
 * the three live rooms. Each section is its own component, owned by the
 * agent building that room (docs/NFFGA_CONTRACT.md).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { BrandMark } from '../shared/Logo';
import { Button } from '../shared/Button';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/design';
import { SITE_LONG_NAME } from '../../constants/site';
import { useSession } from '../../lib/nffga/useSession';
import { TournamentsSection } from './home/TournamentsSection';
import { GearSection } from './home/GearSection';
import { BoardSection } from './home/BoardSection';
import { SiteFooter } from './SiteFooter';

export function HomeScreen() {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const wide = width >= 900;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.scroll}>
      <View style={s.hero}>
        <BrandMark size={wide ? 140 : 112} />
        <Text style={s.name}>NFFGA</Text>
        <Text style={s.long}>{SITE_LONG_NAME}</Text>
        <View style={s.ctas}>
          {!session && (
            <Button title="Join free" onPress={() => router.push('/join' as any)} variant="primary" size="lg" />
          )}
          <Button title="Tournaments" onPress={() => router.push('/tournaments' as any)} variant="outline" size="lg" />
          <Button title="Gear trade" onPress={() => router.push('/gear' as any)} variant="outline" size="lg" />
        </View>
      </View>

      <View style={[s.sections, wide && s.sectionsWide]}>
        <View style={wide ? s.col : undefined}><TournamentsSection /></View>
        <View style={wide ? s.col : undefined}><GearSection /></View>
      </View>
      <View style={s.sections}>
        <BoardSection />
      </View>

      <SiteFooter />
    </ScrollView>
  );
}

function makeStyles() { return StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.md },
  hero: {
    alignItems: 'center', gap: Spacing.xs,
    paddingTop: Spacing.xl, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  name: { fontSize: 40, fontWeight: '800', letterSpacing: 10, color: Colors.textPrimary, marginTop: Spacing.sm },
  long: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  ctas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  sections: {
    gap: Spacing.xl, paddingHorizontal: Spacing.md, paddingTop: Spacing.xl,
    maxWidth: 1080, width: '100%', alignSelf: 'center',
  },
  sectionsWide: { flexDirection: 'row' },
  col: { flex: 1, minWidth: 0 },
}); }
