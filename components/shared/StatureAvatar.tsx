/**
 * StatureAvatar — avatar that telegraphs family standing.
 *
 * Layout:
 *   ┌──────────┐
 *   │  M  ⁺²  │   ← stature letter (M = Matriarch, P = Patriarch, etc.)
 *   │       ₅₃│   ← superscript: max generation gap; subscript: 3-hop network reach
 *   └──────────┘
 *
 * If the user has uploaded a real avatar photo, we show that with the
 * stature mark as a small chip in the corner instead. Otherwise the
 * letter takes the whole circle.
 *
 * The data comes from the `profile_stature_summary(uuid)` RPC which
 * returns the most senior stature across all of a user's families,
 * plus their maximum generation depth, plus their 3-hop reach.
 *
 * Memoized at the network level via TanStack Query so a feed full of
 * the same author doesn't fire 50 RPCs.
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/colors';

export type FamilyStature =
  | 'matriarch' | 'patriarch' | 'elder' | 'parent'
  | 'guardian' | 'sibling' | 'offspring' | 'child';

interface Summary {
  stature: FamilyStature | null;
  generation: number;
  network_reach: number;
}

const LETTER: Record<FamilyStature, string> = {
  matriarch: 'M',
  patriarch: 'P',
  elder: 'E',
  parent: 'A',     // 'A' for Adult — avoids confusion with 'P'
  guardian: 'G',
  sibling: 'S',
  offspring: 'O',
  child: 'C',
};

/**
 * Hook: stature summary for a profile. Public RPC; cached 5 min since
 * stature only changes when family memberships change.
 */
export function useStatureSummary(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['stature-summary', profileId],
    queryFn: async (): Promise<Summary> => {
      if (!profileId) return { stature: null, generation: 0, network_reach: 0 };
      const { data, error } = await supabase
        .rpc('profile_stature_summary', { target: profileId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        stature: (row?.stature ?? null) as FamilyStature | null,
        generation: Number(row?.generation ?? 0),
        network_reach: Number(row?.network_reach ?? 0),
      };
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}

interface StatureAvatarProps {
  profileId: string | null | undefined;
  /** Fallback display name for the no-stature, no-photo state. */
  name?: string | null;
  /** Real avatar URL — when present we show the photo + a stature chip. */
  photoUrl?: string | null;
  /** Outer size in px. */
  size?: number;
  /** Hide the superscript/subscript metadata (for tiny avatars). */
  hideMeta?: boolean;
}

export function StatureAvatar({
  profileId, name, photoUrl, size = 44, hideMeta = false,
}: StatureAvatarProps) {
  const s = makeStyles(size);
  const { data: summary } = useStatureSummary(profileId);
  const stature = summary?.stature ?? null;
  const generation = summary?.generation ?? 0;
  const reach = summary?.network_reach ?? 0;

  const letter = stature ? LETTER[stature] : (name ?? '?').slice(0, 1).toUpperCase();
  const showMeta = !hideMeta && (generation > 0 || reach > 0);

  return (
    <View style={s.wrap}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={s.photo} />
      ) : (
        <View style={s.circle}>
          <Text style={s.letter}>{letter}</Text>
        </View>
      )}

      {/* Photo path: small stature chip in the bottom-right corner. */}
      {photoUrl && stature && (
        <View style={s.chip}>
          <Text style={s.chipLetter}>{LETTER[stature]}</Text>
        </View>
      )}

      {/* Generation superscript (top-right) */}
      {showMeta && generation > 0 && (
        <View style={s.superscript}>
          <Text style={s.superscriptText}>+{generation}</Text>
        </View>
      )}

      {/* Network reach subscript (bottom-right, if no photo or no stature chip) */}
      {showMeta && reach > 0 && (!photoUrl || !stature) && (
        <View style={s.subscript}>
          <Text style={s.subscriptText}>{reach > 99 ? '99+' : reach}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(size: number) {
  const r = size / 2;
  const meta = Math.max(14, Math.round(size * 0.36));
  const fontMain = Math.round(size * 0.42);
  const fontMeta = Math.max(8, Math.round(size * 0.22));
  return StyleSheet.create({
    wrap: { width: size, height: size, position: 'relative' },
    circle: {
      width: size, height: size, borderRadius: r,
      backgroundColor: Colors.primary,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    photo: { width: size, height: size, borderRadius: r, backgroundColor: Colors.surfaceLight },
    letter: { color: '#FFFFFF', fontWeight: '800', fontSize: fontMain, letterSpacing: 0.5 },

    chip: {
      position: 'absolute',
      right: -2, bottom: -2,
      width: meta, height: meta, borderRadius: meta / 2,
      backgroundColor: Colors.primary,
      borderWidth: 2, borderColor: Colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    chipLetter: { color: '#FFFFFF', fontWeight: '800', fontSize: Math.max(9, Math.round(meta * 0.5)) },

    superscript: {
      position: 'absolute',
      top: -3, right: -4,
      paddingHorizontal: 4, paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: Colors.primaryDark,
      borderWidth: 1.5, borderColor: Colors.surface,
    },
    superscriptText: { color: '#FFFFFF', fontWeight: '700', fontSize: fontMeta, lineHeight: fontMeta + 1 },

    subscript: {
      position: 'absolute',
      bottom: -3, right: -4,
      paddingHorizontal: 4, paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: Colors.surfaceLight,
      borderWidth: 1.5, borderColor: Colors.surface,
    },
    subscriptText: { color: Colors.textPrimary, fontWeight: '700', fontSize: fontMeta, lineHeight: fontMeta + 1 },
  });
}
