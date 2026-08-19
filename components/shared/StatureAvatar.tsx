/**
 * StatureAvatar — the person's picture, and nothing else.
 *
 * It used to hang three badges off the corners: a letter chip for crew
 * stature, a superscript for generation depth, and a subscript for
 * 3-hop network reach. Together they read as iOS furniture — pips and
 * counters bolted to a photograph — which is not what this app looks
 * like. Removed on request.
 *
 * The stature itself is not gone from the product; it is still set and
 * shown as a plain role on the profile's crew rows, where it is a word
 * rather than a decoration.
 *
 * DO NOT ADD A BADGE PROP. There is no `hideMeta` any more and there
 * should not be a `showStature` either: an optional slot is how the
 * furniture comes back. If a screen genuinely needs to display someone's
 * standing, it should render it as text next to the name.
 *
 * With the badges went the profile_stature_summary RPC this component
 * fired per avatar. A feed of fifty posts now makes zero of those calls.
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../constants/colors';

export type FamilyStature =
  | 'matriarch' | 'patriarch' | 'elder' | 'parent'
  | 'guardian' | 'sibling' | 'offspring' | 'child';

interface StatureAvatarProps {
  /** Kept so callers need no edit; nothing is fetched with it now. */
  profileId?: string | null;
  /** Fallback initial when there is no photo. */
  name?: string | null;
  photoUrl?: string | null;
  /** Outer size in px. */
  size?: number;
}

export function StatureAvatar({ name, photoUrl, size = 44 }: StatureAvatarProps) {
  const s = makeStyles(size);
  const letter = (name ?? '?').slice(0, 1).toUpperCase();

  return photoUrl
    ? <Image source={{ uri: photoUrl }} style={s.photo} />
    : (
      <View style={s.circle}>
        <Text style={s.letter}>{letter}</Text>
      </View>
    );
}

function makeStyles(size: number) {
  // Square-ish avatars (rounded-square / squircle) instead of full circles.
  // Radius scales with size so a 28px avatar gets a small radius and a
  // 64px gets a more prominent one without ever going fully round.
  const r = Math.max(6, Math.round(size * 0.18));
  const fontMain = Math.round(size * 0.42);
  return StyleSheet.create({
    circle: {
      width: size, height: size, borderRadius: r,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    photo: { width: size, height: size, borderRadius: r, backgroundColor: Colors.surfaceLight },
    letter: { color: '#FFFFFF', fontWeight: '800', fontSize: fontMain, letterSpacing: 0.5 },
  });
}
