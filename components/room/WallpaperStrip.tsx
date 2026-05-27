/**
 * WallpaperStrip — an inline row of wallpaper swatches.
 *
 * Lives at the top of the Room so the user discovers that the wall
 * behind them is a *choice*. Each swatch is a tiny live preview of
 * the pattern (rendered as a tiled background-image on web). Tap one
 * to apply. Active wallpaper carries a gold ring. A trailing "All →"
 * tile routes to the full picker at /profile.
 *
 * Web-only — the picker swatch render relies on background-image with
 * a data URI, which is a web concept. On native the strip collapses.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useWallpaper, WALLPAPER_LIST, wallpaperToDataUri,
  type WallpaperId,
} from '../../stores/wallpaperStore';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/design';

// Hand-picked highlights — a representative spread across schools.
// The full grid lives at /profile (ArtPreferences), reachable from
// the "All →" tile.
const FEATURED: WallpaperId[] = [
  'plain',
  'morris-trellis',
  'morris-willow',
  'damask',
  'art-deco',
  'moorish-star',
  'toile',
  'mod-dots',
  'owen-jones-043',
  'demorgan-blue-dragon',
];

export function WallpaperStrip() {
  if (Platform.OS !== 'web') return null;
  const s = makeStyles();
  const activeId = useWallpaper((st) => st.id);
  const setWallpaper = useWallpaper((st) => st.setWallpaper);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>The wall</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        style={{ flexShrink: 1 }}
      >
        {FEATURED.map((id) => {
          const w = WALLPAPER_LIST.find((x) => x.id === id);
          if (!w) return null;
          const active = activeId === id;
          const bg = w.imageUrl
            ? `url("${w.imageUrl}")`
            : w.svg
              ? wallpaperToDataUri(w)
              : '';
          const tileStyle = bg ? ({
            backgroundImage: bg,
            backgroundSize: w.imageUrl ? 'cover' : `${Math.min(w.tileSize, 32)}px`,
            backgroundPosition: 'center',
            backgroundColor: w.swatchBg,
          } as any) : { backgroundColor: w.swatchBg };

          return (
            <TouchableOpacity
              key={id}
              onPress={() => setWallpaper(id)}
              activeOpacity={0.85}
              style={s.swatch}
              accessibilityLabel={`Apply ${w.label} wallpaper`}
            >
              <View style={[
                s.swatchInner,
                tileStyle,
                active && {
                  borderColor: Colors.primary,
                  borderWidth: 2,
                  ...(Platform.OS === 'web' ? ({
                    boxShadow: `0 0 0 2px ${Colors.background}, 0 0 0 4px ${Colors.primary}`,
                  } as any) : {}),
                },
              ]} />
              <Text
                style={[s.swatchLabel, active && s.swatchLabelActive]}
                numberOfLines={1}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* All wallpapers → full picker */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile' as any)}
          activeOpacity={0.85}
          style={s.swatch}
          accessibilityLabel="Browse all wallpapers"
        >
          <View style={s.allInner}>
            <Ionicons name="ellipsis-horizontal" size={14} color={Colors.primary} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  // A discreet row centred under the masthead. Round swatches, no
  // labels — it reads as decoration first, picker second. The active
  // wallpaper carries a gold ring.
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.8, textTransform: 'uppercase',
    marginRight: 6,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  strip: {
    flexDirection: 'row', gap: 8,
    alignItems: 'center',
  },
  swatch: { alignItems: 'center', justifyContent: 'center' },
  swatchInner: {
    width: 28, height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  // Label-per-swatch suppressed in this strip — keeping the row light.
  // Hover tooltip is the accessibilityLabel.
  swatchLabel: { display: 'none' as any },
  swatchLabelActive: {},
  allInner: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
}); }
