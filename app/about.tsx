/**
 * /about — the thesis, indexed.
 *
 * The one public page that says what this is, written for the person
 * who walked past and the crawler that indexes. Marketing copy is
 * content here, not chrome: declarative sentences, no onboarding, no
 * email capture, no signup wall. Two ways in at the bottom.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Spacing, Radius, Type } from '../constants/design';
import { Button } from '../components/shared/Button';
import { Eyebrow } from '../components/shared/Eyebrow';
import { HereTooLogo, HereTooMark } from '../components/shared/Logo';

export default function AboutScreen() {
  const s = makeStyles();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.masthead}>
          <HereTooMark size={40} />
          <HereTooLogo size={64} />
          <Text style={s.slogan}>Are you intelligent enough to be HereToo?</Text>
          <Text style={s.ground}>The anti-social media. Art, music, and Shakespeare.</Text>
        </View>

        <View style={s.thesis}>
          <Text style={s.para}>
            There are no strangers on your feed. Not filtered out. Impossible.
            You see the people your circles reach, and no one else.
          </Text>
          <Text style={s.para}>
            The unit here is the cohort: a family, a school class, a team, a
            friend group. Any real container of real people. You join one or
            you start one. Your feed grows one way only: cohorts linking to
            cohorts, each link a real person vouching. Nobody grows a
            following here. People grow a neighborhood.
          </Text>
          <Text style={s.para}>
            One room is open to everyone: the public square. No names, no
            faces, no photographs, no video. Text, under a pseudonym. If you
            want people to find your cohort, you convince them with prose.
            Writing is the only advertisement for yourself this place sells.
          </Text>
          <Text style={s.para}>
            There is no For You. No follower counts, no metrics, no streaks,
            no algorithmic feed deciding what you deserve. Messages can burn
            after reading, overwritten in the database at the moment they are
            read, not hidden. The journal is sealed with a key that never
            leaves your device; nobody can read it, including us. A lost
            passphrase is unrecoverable. That is the design working.
          </Text>
          <Text style={s.para}>
            The ads are small businesses only. A jeweler, an Etsy maker, the
            ice-cream shop, hand-placed and held to the same artistic standard
            as the gallery they hang in. No tracking, no surveillance, no data
            sold, none collected to sell. The town paper's back page, not a
            billboard.
          </Text>
          <Text style={s.para}>
            Built by one writer, in Providence, for the people he actually
            knows. It grows the way a good bar grows: regulars telling
            regulars.
          </Text>
        </View>

        <View style={s.huntCard}>
          <Eyebrow accentColor={Colors.primary}>Deaddrop</Eyebrow>
          <Button
            title="Open Deaddrop"
            onPress={() => router.push('/hunt' as any)}
            variant="primary"
            style={s.pillCta}
            icon={<Ionicons name="navigate" size={16} color={Colors.onPrimary} />}
          />
        </View>

        <View style={s.actions}>
          <Button
            title="Step inside"
            onPress={() => router.replace('/(auth)/welcome' as any)}
            variant="primary"
            style={s.pillCta}
            icon={<Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />}
          />
          <Button
            title="Advertise"
            onPress={() => router.push('/advertise' as any)}
            variant="ghost"
          />
        </View>

        {/* Publisher-facing fair-use notice. Legal copy, not explainer
            copy — it keeps its home here. */}
        <Text style={s.footnote}>
          News headlines and summaries appear on HereToo under standard fair-use
          practice for aggregators. The full reporting lives on the publisher&apos;s
          site. Support public broadcasting directly when you can.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.lg },

  masthead: { gap: 10 },
  slogan: {
    fontSize: Type.title.size, lineHeight: Type.title.lineHeight,
    fontWeight: '600', color: Colors.textPrimary, marginTop: 4,
  },
  ground: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
    color: Colors.textSecondary,
  },

  thesis: { gap: Spacing.md },
  para: {
    fontSize: Type.body.size, lineHeight: Type.body.lineHeight + 4,
    color: Colors.textPrimary,
  },

  huntCard: {
    gap: Spacing.xs, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.control,
  },
  actions: { gap: Spacing.xs },
  pillCta: { alignSelf: 'flex-start' },
  footnote: {
    fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight,
    color: Colors.textMuted,
  },
}); }
