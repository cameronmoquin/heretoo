/**
 * HomeScreen — what the QR code opens. Public: no sign-in to look around.
 *
 * The crest and the name, then upcoming tournaments and the gear trade,
 * side by side on desktop and stacked on a phone. The feed lives in the
 * Clubhouse only (Cameron, 2026-10-04: "leave the feed in the clubhouse
 * and keep it off the main page for now"); HomeFeed is kept for when it
 * comes back.
 *
 * Under the name: the editable tagline ('home.tagline', hidden when
 * empty) and, when admins have added any, the home gallery photos
 * (/admin → Photos, placement 'home_gallery').
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
import { useCopy } from '../../lib/nffga/copy';
import { SitePhotoStrip } from './SitePhotoStrip';
import { TournamentsSection } from './home/TournamentsSection';
import { GearSection } from './home/GearSection';
import { SiteFooter } from './SiteFooter';

export function HomeScreen() {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const { session } = useSession();
  const tagline = useCopy('home.tagline');
  const wide = width >= 900;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.scroll}>
      <View style={[s.hero, !wide && s.heroCompact]}>
        <BrandMark size={wide ? 120 : 88} />
        <Text style={[s.name, !wide && s.nameCompact]}>NFFGA</Text>
        <Text style={s.long}>{SITE_LONG_NAME}</Text>
        {tagline ? <Text style={s.tagline}>{tagline}</Text> : null}
        {!session && (
          <View style={s.ctas}>
            <Button title="Join free" onPress={() => router.push('/join' as any)} variant="primary" size="lg" />
            <Button title="Sign in" onPress={() => router.push('/signin' as any)} variant="outline" size="lg" />
          </View>
        )}
      </View>

      <SitePhotoStrip placement="home_gallery" style={wide ? s.galleryWide : s.gallery} />

      <View style={[s.body, wide && s.bodyWide]}>
        <View style={wide ? s.half : undefined}>
          <TournamentsSection />
        </View>
        <View style={wide ? s.half : undefined}>
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
  tagline: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary, textAlign: 'center', maxWidth: 560 },
  gallery: { paddingTop: Spacing.md },
  galleryWide: { paddingTop: Spacing.lg, paddingHorizontal: Spacing.md, maxWidth: 1080, alignSelf: 'center' },
  ctas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  body: {
    gap: Spacing.xl, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg,
    maxWidth: 1080, width: '100%', alignSelf: 'center',
  },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  half: { flex: 1, minWidth: 0 },
}); }
