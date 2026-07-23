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
import {
  useWallpaper, WALLPAPER_LIST, wallpaperToDataUri,
  wallpapersBySchool, WALLPAPERS,
} from '../../stores/wallpaperStore';
import { useTTS } from '../../stores/ttsStore';
import { Colors } from '../../constants/colors';
import { Vocab } from '../../constants/vocab';

interface ArtPreferencesProps {
  /** Compact mode hides the title — for sidebar usage. */
  compact?: boolean;
}

export function ArtPreferences({ compact = false }: ArtPreferencesProps) {
  const s = makeStyles();
  const [expanded, setExpanded] = useState(!compact);

  // Live store state — what's currently applied. Picker shows the
  // DRAFT below; tapping pills mutates the draft only. "Apply" copies
  // draft → store, which triggers persist + DB sync + feed refetch.
  const liveSchools = useArtPrefs((st) => st.schools);
  const liveEras = useArtPrefs((st) => st.eras);
  const liveGenres = useArtPrefs((st) => st.genres);
  const liveMediums = useArtPrefs((st) => st.mediums);
  const liveSources = useArtPrefs((st) => st.sources);
  const liveFeedMix = useArtPrefs((st) => st.feedMix);
  const applyAll = useArtPrefs((st) => st.applyAll);
  const clear = useArtPrefs((st) => st.clear);
  const { data: facets } = useArtFacets();
  const filterStatus = useArtFilterStatus();
  const wallpaperId = useWallpaper((st) => st.id);
  const setWallpaper = useWallpaper((st) => st.setWallpaper);
  const bold = useWallpaper((st) => st.bold);
  const toggleBold = useWallpaper((st) => st.toggleBold);

  // Draft state — local mirror of the filter axes. Initialized from
  // the live store on first render and kept in sync with external
  // changes (e.g., another tab) via the resync effect below.
  const [draftSchools, setDraftSchools] = useState<string[]>(liveSchools);
  const [draftEras, setDraftEras] = useState<ArtEra[]>(liveEras);
  const [draftGenres, setDraftGenres] = useState<string[]>(liveGenres);
  const [draftMediums, setDraftMediums] = useState<string[]>(liveMediums);
  const [draftSources, setDraftSources] = useState<string[]>(liveSources);
  const [draftFeedMix, setDraftFeedMix] = useState<FeedMix>(liveFeedMix);

  // Re-sync from the store when an external change lands (clear()
  // triggered elsewhere, or a setStation-style direct mutation).
  React.useEffect(() => { setDraftSchools(liveSchools); }, [liveSchools]);
  React.useEffect(() => { setDraftEras(liveEras); }, [liveEras]);
  React.useEffect(() => { setDraftGenres(liveGenres); }, [liveGenres]);
  React.useEffect(() => { setDraftMediums(liveMediums); }, [liveMediums]);
  React.useEffect(() => { setDraftSources(liveSources); }, [liveSources]);
  React.useEffect(() => { setDraftFeedMix(liveFeedMix); }, [liveFeedMix]);

  // Toggle helpers operate on draft only — no persist, no sync.
  const toggleIn = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const toggleSchoolDraft = (v: string) => setDraftSchools((c) => toggleIn(c, v));
  const toggleEraDraft = (v: ArtEra) => setDraftEras((c) => toggleIn(c, v));
  const toggleGenreDraft = (v: string) => setDraftGenres((c) => toggleIn(c, v));
  const toggleMediumDraft = (v: string) => setDraftMediums((c) => toggleIn(c, v));
  const toggleSourceDraft = (v: string) => setDraftSources((c) => toggleIn(c, v));

  // Has the draft drifted from what's currently applied?
  const dirty =
    !arrEq(draftSchools, liveSchools)
    || !arrEq(draftEras, liveEras)
    || !arrEq(draftGenres, liveGenres)
    || !arrEq(draftMediums, liveMediums)
    || !arrEq(draftSources, liveSources)
    || draftFeedMix !== liveFeedMix;

  const onApply = () => {
    applyAll({
      schools: draftSchools,
      eras: draftEras,
      genres: draftGenres,
      mediums: draftMediums,
      sources: draftSources,
      feedMix: draftFeedMix,
    });
  };

  // The pills below render against the DRAFT state, not the live one.
  const schools = draftSchools;
  const eras = draftEras;
  const genres = draftGenres;
  const mediums = draftMediums;
  const sources = draftSources;
  const feedMix = draftFeedMix;
  const toggleSchool = toggleSchoolDraft;
  const toggleEra = toggleEraDraft;
  const toggleGenre = toggleGenreDraft;
  const toggleMedium = toggleMediumDraft;
  const toggleSource = toggleSourceDraft;
  const setFeedMix = setDraftFeedMix;

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
          {/* Apply / Clear button row — pinned at the top of the
              expanded picker. Filter changes ARE deferred to draft
              state (no feed refetch on each pill); tap "Apply" to
              commit. The button is only enabled when the draft has
              drifted from what's applied. */}
          <View style={s.applyRow}>
            <TouchableOpacity
              onPress={onApply}
              disabled={!dirty}
              style={[s.applyBtn, !dirty && s.applyBtnDisabled]}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={14} color={dirty ? '#FFF' : Colors.textMuted} />
              <Text style={[s.applyBtnText, !dirty && { color: Colors.textMuted }]}>
                {dirty ? 'Apply changes' : 'Up to date'}
              </Text>
            </TouchableOpacity>
            {total > 0 && (
              <TouchableOpacity onPress={clear} style={s.clearBtn} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={12} color={Colors.textMuted} />
                <Text style={s.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Wallpaper picker — a small museum. Patterns grouped by
              school. The active pattern's "About this pattern" card
              sits at the top so the user reads the context the way
              they'd read a wall plaque before looking at the work. */}
          <Section label="Wallpaper">
            {(() => {
              const active = WALLPAPERS[wallpaperId as keyof typeof WALLPAPERS];
              if (!active || !active.about) return null;
              return (
                <View style={s.museumPlaque}>
                  <Text style={s.plaqueTitle}>{active.label}</Text>
                  <Text style={s.plaqueEra}>{active.era}</Text>
                  <Text style={s.plaqueAbout}>{active.about}</Text>
                  {!!active.credit && (
                    <Text style={s.plaqueCredit}>{active.credit}</Text>
                  )}
                </View>
              );
            })()}

            {wallpapersBySchool().map((group) => (
              <View key={group.school} style={s.schoolGroup}>
                <Text style={s.schoolTitle}>{group.label}</Text>
                <View style={s.swatchGrid}>
                  {group.items.map((w) => {
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
                        <View
                          style={[
                            s.swatchTile,
                            // Image-mode: render a small thumbnail of the
                            // actual scan. SVG-mode: render the SVG tile.
                            // Plain: solid bg.
                            w.imageUrl
                              ? ({
                                  backgroundImage: `url("${w.imageUrl}")`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  backgroundColor: w.swatchBg,
                                } as any)
                              : swatchTileStyle(w.swatchBg, bgImage, w.tileSize),
                          ]}
                        />
                        <Text style={[s.swatchLabel, on && s.swatchLabelActive]} numberOfLines={1}>
                          {w.label}
                        </Text>
                        <Text style={s.swatchEra} numberOfLines={1}>{w.era}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

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
                </View>
              </TouchableOpacity>
            )}
          </Section>

          {/* Read-aloud pace — Source of Truth M6. Three calibrated
              speeds. Same Bike Messenger voice; different cadence. */}
          <Section label="Read-aloud pace">
            <ReadAloudPace />
          </Section>

          {/* Feed Mix — what shows up between posts */}
          <Section label={`Between ${Vocab.postPlural}`}>
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
              <Text style={s.noMatchText}>No matches.</Text>
            </View>
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

/** Pace picker for read-aloud — 0.85× / 1.0× / 1.15×.
 *  Source of Truth, M6. */
function ReadAloudPace() {
  const s = makeStyles();
  const pace = useTTS((st) => st.pace);
  const setPace = useTTS((st) => st.setPace);
  const opts: Array<{ value: 0.85 | 1.0 | 1.15; label: string }> = [
    { value: 0.85, label: 'Slower' },
    { value: 1.0, label: 'Default' },
    { value: 1.15, label: 'Quicker' },
  ];
  return (
    <View style={{ gap: 6 }}>
      {opts.map((o) => {
        const on = pace === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => setPace(o.value)}
            activeOpacity={0.75}
            style={[
              {
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 12, paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1, borderColor: Colors.border,
              },
              on && { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
            ]}
          >
            <View
              style={{
                width: 12, height: 12, borderRadius: 6,
                borderWidth: 2,
                borderColor: on ? Colors.primary : Colors.border,
                backgroundColor: on ? Colors.primary : 'transparent',
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: on ? Colors.primary : Colors.textPrimary }}>
                {o.label} <Text style={{ fontWeight: '400', color: Colors.textMuted }}>· {o.value.toFixed(2)}×</Text>
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function capitalize(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Order-independent array equality. Sufficient for the filter axes
 *  whose contents are unique strings; any drift here flips the dirty
 *  state. Pre-sort copies so we don't mutate the live store arrays. */
function arrEq<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const aa = [...a].sort();
  const bb = [...b].sort();
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
  return true;
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

  applyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4, paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    marginBottom: 4,
  },
  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  applyBtnDisabled: { backgroundColor: Colors.surfaceLight },
  applyBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },

  noMatchBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    marginTop: 4,
  },
  noMatchText: { flex: 1, fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },

  // Wallpaper picker — small-museum layout
  museumPlaque: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    gap: 4,
  },
  plaqueTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  plaqueEra: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1.4,
  },
  plaqueAbout: {
    fontSize: 12, lineHeight: 18, color: Colors.textSecondary, marginTop: 4,
  },
  plaqueCredit: {
    fontSize: 10, fontStyle: 'italic', color: Colors.textMuted, marginTop: 4,
  },
  schoolGroup: { marginTop: 14, gap: 6 },
  schoolTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 1.6,
  },
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
}); }
