/**
 * ArtPreferences — sidebar widget that lets the user filter the art
 * shown in banners, inline slots, and the desktop sidebar art panel.
 *
 * Three axes:
 *   - Era (Antiquity → Contemporary, parsed from year_created)
 *   - School (Impressionism, Renaissance, Roman, etc., normalized)
 *   - Genre (painting / sculpture / print / etc., from the genre tag)
 *
 * Toggle a pill to add it to the filter; tap again to remove. Empty
 * selections on an axis = no filter applied on that axis.
 *
 * Lives in the desktop left sidebar. Mobile gets the same component
 * inside the profile hub via a "Quick action" entry.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useArtPrefs,
  ERA_LABELS,
  SOURCE_LABELS,
  FEED_MIX_LABELS,
  type ArtEra,
  type FeedMix,
} from '../../stores/artPrefsStore';
import { useArtFacets, useArtFilterStatus } from '../../hooks/useArtFeed';
import { useWallpaper, WALLPAPER_LIST, wallpaperToDataUri } from '../../stores/wallpaperStore';
import { Colors } from '../../constants/colors';

interface ArtPreferencesProps {
  /** Compact mode hides the title — for sidebar usage. */
  compact?: boolean;
}

export function ArtPreferences({ compact = false }: ArtPreferencesProps) {
  const s = makeStyles();
  const [expanded, setExpanded] = useState(!compact);
  const schools = useArtPrefs((st) => st.schools);
  const eras = useArtPrefs((st) => st.eras);
  const genres = useArtPrefs((st) => st.genres);
  const mediums = useArtPrefs((st) => st.mediums);
  const sources = useArtPrefs((st) => st.sources);
  const feedMix = useArtPrefs((st) => st.feedMix);
  const toggleSchool = useArtPrefs((st) => st.toggleSchool);
  const toggleEra = useArtPrefs((st) => st.toggleEra);
  const toggleGenre = useArtPrefs((st) => st.toggleGenre);
  const toggleMedium = useArtPrefs((st) => st.toggleMedium);
  const toggleSource = useArtPrefs((st) => st.toggleSource);
  const setFeedMix = useArtPrefs((st) => st.setFeedMix);
  const clear = useArtPrefs((st) => st.clear);
  const { data: facets } = useArtFacets();
  const filterStatus = useArtFilterStatus();
  const wallpaperId = useWallpaper((st) => st.id);
  const setWallpaper = useWallpaper((st) => st.setWallpaper);
  const bold = useWallpaper((st) => st.bold);
  const toggleBold = useWallpaper((st) => st.toggleBold);

  const total = schools.length + eras.length + genres.length + mediums.length + sources.length;
  // Show a "no matches" hint only when filters are actually active and
  // the resulting pool is empty (and we're not still loading).
  const showNoMatch =
    filterStatus.active && !filterStatus.isLoading && filterStatus.matched === 0;

  return (
    <View style={s.wrap}>
      <Pressable style={s.header} onPress={() => setExpanded((e) => !e)}>
        <Ionicons name="color-palette-outline" size={14} color={Colors.textSecondary} />
        <Text style={s.title}>Gallery filter{total > 0 ? ` · ${total}` : ''}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textMuted}
        />
      </Pressable>

      {expanded && (
        <ScrollView style={s.body} contentContainerStyle={{ gap: 12 }}>
          {/* Wallpaper picker — sits above the gallery filter so users
              find the decoration controls without digging. */}
          <Section label="Wallpaper">
            <View style={s.swatchGrid}>
              {WALLPAPER_LIST.map((w) => {
                const on = wallpaperId === w.id;
                const bgImage = w.svg ? wallpaperToDataUri(w) : '';
                return (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => setWallpaper(w.id)}
                    style={[s.swatch, on && s.swatchActive]}
                    activeOpacity={0.75}
                    accessibilityLabel={`${w.label} wallpaper`}
                  >
                    {/* Visual preview tile. Plain swatch is solid bg.
                        Pattern swatches use the actual pattern at
                        scaled-down tile size for an honest preview. */}
                    <View style={[s.swatchTile, swatchTileStyle(w.swatchBg, bgImage, w.tileSize)]} />
                    <Text style={[s.swatchLabel, on && s.swatchLabelActive]} numberOfLines={1}>
                      {w.label}
                    </Text>
                    <Text style={s.swatchEra} numberOfLines={1}>{w.era}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {wallpaperId !== 'plain' && (
              <TouchableOpacity
                onPress={toggleBold}
                style={s.boldRow}
                activeOpacity={0.75}
              >
                <View style={[s.checkbox, bold && s.checkboxActive]}>
                  {bold && <Ionicons name="checkmark" size={11} color="#FFF" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.boldTitle}>Bold pattern</Text>
                  <Text style={s.boldSub}>
                    Render the wallpaper at full saturation. Default tones it down so it reads as decor.
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </Section>

          {/* Feed Mix — what shows up between posts */}
          <Section label="Between posts">
            <View style={s.mixCol}>
              {(Object.keys(FEED_MIX_LABELS) as FeedMix[]).map((m) => {
                const on = feedMix === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setFeedMix(m)}
                    style={[s.mixRow, on && s.mixRowActive]}
                    activeOpacity={0.75}
                  >
                    <View style={[s.mixDot, on && s.mixDotActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.mixTitle, on && s.mixTitleActive]}>
                        {FEED_MIX_LABELS[m].title}
                      </Text>
                      <Text style={s.mixSub}>{FEED_MIX_LABELS[m].sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Era */}
          <Section label="Era">
            <View style={s.pillRow}>
              {(Object.keys(ERA_LABELS) as ArtEra[]).map((e) => {
                const on = eras.includes(e);
                const count = facets?.eraCounts?.[e] ?? 0;
                if (count === 0) return null;
                return (
                  <TouchableOpacity
                    key={e}
                    onPress={() => toggleEra(e)}
                    style={[s.pill, on && s.pillActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.pillText, on && s.pillTextActive]}>
                      {ERA_LABELS[e]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* School */}
          {(facets?.topSchools.length ?? 0) > 0 && (
            <Section label="School / style">
              <View style={s.pillRow}>
                {facets!.topSchools.map((row) => {
                  const on = schools.includes(row.key);
                  return (
                    <TouchableOpacity
                      key={row.key}
                      onPress={() => toggleSchool(row.key)}
                      style={[s.pill, on && s.pillActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.pillText, on && s.pillTextActive]}>
                        {capitalize(row.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>
          )}

          {/* Genre */}
          {(facets?.topGenres.length ?? 0) > 0 && (
            <Section label="Genre">
              <View style={s.pillRow}>
                {facets!.topGenres.map((row) => {
                  const on = genres.includes(row.key);
                  return (
                    <TouchableOpacity
                      key={row.key}
                      onPress={() => toggleGenre(row.key)}
                      style={[s.pill, on && s.pillActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.pillText, on && s.pillTextActive]}>
                        {capitalize(row.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>
          )}

          {/* Medium */}
          {(facets?.topMediums?.length ?? 0) > 0 && (
            <Section label="Medium">
              <View style={s.pillRow}>
                {facets!.topMediums!.map((row) => {
                  const on = mediums.includes(row.key);
                  return (
                    <TouchableOpacity
                      key={row.key}
                      onPress={() => toggleMedium(row.key)}
                      style={[s.pill, on && s.pillActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.pillText, on && s.pillTextActive]}>
                        {capitalize(row.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>
          )}

          {/* Source / museum */}
          {(facets?.sources?.length ?? 0) > 0 && (
            <Section label="Museum">
              <View style={s.pillRow}>
                {facets!.sources!.map((row) => {
                  const on = sources.includes(row.key);
                  return (
                    <TouchableOpacity
                      key={row.key}
                      onPress={() => toggleSource(row.key)}
                      style={[s.pill, on && s.pillActive]}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.pillText, on && s.pillTextActive]}>
                        {SOURCE_LABELS[row.key] ?? capitalize(row.key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>
          )}

          {showNoMatch && (
            <View style={s.noMatchBox}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
              <Text style={s.noMatchText}>
                Nothing in the gallery matches all of these filters yet. Try removing one.
              </Text>
            </View>
          )}

          {total > 0 && (
            <TouchableOpacity onPress={clear} style={s.clearBtn} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={12} color={Colors.textMuted} />
              <Text style={s.clearBtnText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const s = makeStyles();
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function capitalize(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Web-only inline style helper for swatch tiles. RN's ViewStyle type
 * doesn't include CSS background props, so we build the style as an
 * `any` and let RN-on-web pick them up at runtime. Native gets the
 * solid backgroundColor only — no image — which is the correct
 * fallback until we ship a native wallpaper renderer.
 */
function swatchTileStyle(bg: string, bgImage: string, tileSize: number): any {
  return {
    backgroundColor: bg,
    backgroundImage: bgImage,
    backgroundRepeat: 'repeat',
    backgroundSize: `${tileSize / 1.4}px ${tileSize / 1.4}px`,
  };
}

function makeStyles() { return StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  title: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.2 },
  body: { paddingHorizontal: 10, paddingBottom: 10, maxHeight: 360 },

  section: { gap: 6 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.2,
    paddingHorizontal: 2,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  pillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  pillTextActive: { color: Colors.primary },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 4,
  },
  clearBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  noMatchBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 4,
  },
  noMatchText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },

  // Wallpaper picker grid
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 88, gap: 4,
    padding: 4, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  swatchActive: { borderColor: Colors.primary },
  swatchTile: {
    width: '100%', height: 56, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  swatchLabel: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary },
  swatchLabelActive: { color: Colors.primary },
  swatchEra: { fontSize: 10, color: Colors.textMuted, marginTop: -2 },

  boldRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 4, paddingVertical: 6, marginTop: 2,
  },
  checkbox: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  boldTitle: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  boldSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1, lineHeight: 14 },

  mixCol: { gap: 4 },
  mixRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8,
  },
  mixRowActive: { backgroundColor: Colors.primaryFaint },
  mixDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: Colors.border,
  },
  mixDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  mixTitle: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  mixTitleActive: { color: Colors.primary },
  mixSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
}); }
