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
  type ArtEra,
} from '../../stores/artPrefsStore';
import { useArtFacets } from '../../hooks/useArtFeed';
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
  const toggleSchool = useArtPrefs((st) => st.toggleSchool);
  const toggleEra = useArtPrefs((st) => st.toggleEra);
  const toggleGenre = useArtPrefs((st) => st.toggleGenre);
  const toggleMedium = useArtPrefs((st) => st.toggleMedium);
  const toggleSource = useArtPrefs((st) => st.toggleSource);
  const clear = useArtPrefs((st) => st.clear);
  const { data: facets } = useArtFacets();

  const total = schools.length + eras.length + genres.length + mediums.length + sources.length;

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
}); }
