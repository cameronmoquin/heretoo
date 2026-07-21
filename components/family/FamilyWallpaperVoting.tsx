/**
 * Crew-wallpaper voting widget, drop-in for the crew page About
 * tab. Shows the currently effective wallpaper at the top, then a
 * grid of swatches the user can tap to cast / change their vote.
 *
 * Everyone in the crew votes; plurality wins; ties go to the most
 * recent vote (per the effective_family_wallpaper RPC). Default when
 * no votes exist = the crew owner's personal wallpaper.
 *
 * The visible wallpaper updates on the crew page as soon as the
 * effective query refetches after the vote (handled by the hook's
 * onSettled invalidation).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useEffectiveFamilyWallpaper,
  useMyFamilyWallpaperVote,
  useVoteFamilyWallpaper,
} from '../../hooks/useFamilyWallpaper';
import {
  WALLPAPER_LIST, WALLPAPERS, wallpaperToDataUri,
  type WallpaperId,
} from '../../stores/wallpaperStore';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  familyId: string;
}

export function FamilyWallpaperVoting({ familyId }: Props) {
  const s = makeStyles();
  const { data: effectiveId } = useEffectiveFamilyWallpaper(familyId);
  const { data: myVote } = useMyFamilyWallpaperVote(familyId);
  const vote = useVoteFamilyWallpaper();

  const effective = effectiveId
    ? WALLPAPERS[effectiveId as keyof typeof WALLPAPERS]
    : null;

  const onVote = (id: WallpaperId) => {
    vote.mutate({ familyId, wallpaperId: id });
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="color-fill-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.eyebrow}>Crew wallpaper</Text>
      </View>

      {/* Currently effective + your own vote */}
      <View style={s.statusRow}>
        <Text style={s.statusLabel}>Currently:</Text>
        <Text style={s.statusValue}>
          {effective ? `${effective.label} (${effective.era})` : 'Plain'}
        </Text>
      </View>
      {myVote && (
        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Your vote:</Text>
          <Text style={s.statusValue}>
            {WALLPAPERS[myVote as keyof typeof WALLPAPERS]?.label ?? 'Plain'}
          </Text>
        </View>
      )}

      <Text style={s.gridLabel}>Cast your vote</Text>
      <View style={s.grid}>
        {WALLPAPER_LIST.map((w) => {
          const isMyVote = myVote === w.id;
          const isEffective = effectiveId === w.id;
          const bgImage = w.svg ? wallpaperToDataUri(w) : '';
          return (
            <TouchableOpacity
              key={w.id}
              onPress={() => onVote(w.id as WallpaperId)}
              style={[
                s.swatch,
                isMyVote && s.swatchVoted,
              ]}
              activeOpacity={0.75}
              accessibilityLabel={`Vote for ${w.label}`}
              disabled={vote.isPending}
            >
              <View
                style={[
                  s.swatchTile,
                  // RN-on-web inline bg
                  ({
                    backgroundColor: w.swatchBg,
                    backgroundImage: bgImage,
                    backgroundRepeat: 'repeat',
                    backgroundSize: `${w.tileSize / 1.4}px ${w.tileSize / 1.4}px`,
                  } as any),
                ]}
              />
              <Text style={[s.swatchLabel, isMyVote && { color: Colors.primary }]} numberOfLines={1}>
                {w.label}
              </Text>
              {isEffective && (
                <View style={s.effectiveBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  statusRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  statusValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },

  gridLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 84, gap: 4,
    padding: 4, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'transparent',
    position: 'relative',
  },
  swatchVoted: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  swatchTile: {
    width: '100%', height: 52, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  swatchLabel: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  effectiveBadge: {
    position: 'absolute',
    top: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.surface,
  },
}); }
