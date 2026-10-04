/**
 * HomeScreen — what the QR code opens. Public: no sign-in to look around.
 *
 * The crest and the name, then the FEED as the main column (Cameron,
 * 2026-10-04), with upcoming tournaments and the gear trade beside it on
 * desktop and below it on a phone. Each side section is owned by the
 * agent that built that room (docs/NFFGA_CONTRACT.md).
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
import { HomeFeed } from './HomeFeed';
import { SiteFooter } from './SiteFooter';

export function HomeScreen() {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const wide = width >= 900;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.scroll}>
      <View style={[s.hero, !wide && s.heroCompact]}>
        <BrandMark size={wide ? 120 : 88} />
        <Text style={[s.name, !wide && s.nameCompact]}>NFFGA</Text>
        <Text style={s.long}>{SITE_LONG_NAME}</Text>
        {!session && (
          <View style={s.ctas}>
            <Button title="Join free" onPress={() => router.push('/join' as any)} variant="primary" size="lg" />
            <Button title="Sign in" onPress={() => router.push('/signin' as any)} variant="outline" size="lg" />
          </View>
        )}
      </View>

      <View style={[s.body, wide && s.bodyWide]}>
        <View style={wide ? s.main : undefined}>
          <HomeFeed />
        </View>
        <View style={[s.side, wide && s.sideWide]}>
          <TournamentsSection />
          <GearSection />
        </View>
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
    paddingTop: Spacing.xl, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  heroCompact: { paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  name: { fontSize: 40, fontWeight: '800', letterSpacing: 10, color: Colors.textPrimary, marginTop: Spacing.xs },
  nameCompact: { fontSize: 30, letterSpacing: 7 },
  long: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  ctas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  body: {
    gap: Spacing.xl, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg,
    maxWidth: 1080, width: '100%', alignSelf: 'center',
  },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  main: { flex: 1.6, minWidth: 0 },
  side: { gap: Spacing.xl },
  sideWide: { flex: 1, minWidth: 0 },
}); }
