/**
 * TimelineRail — the life, visible while you write.
 *
 * A thin vertical strip on the far left of the memoir: birth at the
 * top, the present at the foot, every dated event a dot in between,
 * placed in PROPORTION to when it happened — a decade of silence looks
 * like a decade of silence. It grows and changes as entries land, since
 * it reads the same query the timeline screen writes.
 *
 * Navigable, not decorative: tap a dot and the timeline opens focused
 * on that event, expanded, with its entries as headings.
 *
 * Undated events don't appear here — a rail is a ruler, and a ruler
 * cannot hold what has no coordinate. They remain on the timeline
 * screen's undated shelf.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useEnsureMemoirProject } from '../../hooks/useMemoir';
import { useTimelineEvents, type TimelineEvent } from '../../hooks/useMemoirTimeline';
import { Colors } from '../../constants/colors';

/** Pixels per year of life. Tall enough to separate school years,
 *  short enough that eighty years still scrolls in a few swipes. */
const YEAR_PX = 26;
const MIN_GAP = 18;

interface Placed {
  event: TimelineEvent;
  y: number;
  year: number;
}

export function TimelineRail() {
  const ensure = useEnsureMemoirProject();
  const { data: events } = useTimelineEvents(ensure.data);

  const placed = useMemo<{ dots: Placed[]; height: number; firstYear: number; lastYear: number } | null>(() => {
    const dated = (events ?? [])
      .filter((e) => !!e.start_date)
      .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
    if (dated.length === 0) return null;

    const firstYear = new Date(String(dated[0].start_date)).getFullYear();
    const lastYear = new Date().getFullYear();
    const span = Math.max(1, lastYear - firstYear);
    const height = span * YEAR_PX + 40;

    let prevY = -Infinity;
    const dots = dated.map((event) => {
      const t = new Date(String(event.start_date));
      const frac = (t.getFullYear() + t.getMonth() / 12 - firstYear) / span;
      // Proportional first, then pushed down just enough that two
      // same-year dots stay separately tappable.
      let y = 16 + Math.max(0, Math.min(1, frac)) * (height - 32);
      if (y - prevY < MIN_GAP) y = prevY + MIN_GAP;
      prevY = y;
      return { event, y, year: t.getFullYear() };
    });

    return { dots, height: Math.max(height, prevY + 40), firstYear, lastYear };
  }, [events]);

  const s = makeStyles();

  // No dated events, no ruler. The rail earns its column or cedes it.
  if (!placed) return null;

  // A year label at the first dot of each year keeps the ruler legible
  // without printing eighty numbers.
  const labelled = new Set<string>();
  const showYear = (d: Placed) => {
    const k = String(d.year);
    if (labelled.has(k)) return false;
    labelled.add(k);
    return true;
  };

  return (
    <View style={s.rail}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ height: placed.height }}>
        <View style={s.spine} />
        {placed.dots.map((d) => (
          <TouchableOpacity
            key={d.event.id}
            style={[s.dotWrap, { top: d.y }]}
            onPress={() => router.push(`/memoir/timeline?focus=${d.event.id}` as any)}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`${d.event.title}, ${d.year}. Open on the timeline.`}
          >
            <View style={s.dot} />
            {showYear(d) && <Text style={s.year}>{String(d.year).slice(2)}</Text>}
          </TouchableOpacity>
        ))}
        <Text style={[s.terminus, { top: 2 }]}>{placed.firstYear}</Text>
        <Text style={[s.terminus, { top: placed.height - 16 }]}>now</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  rail: {
    width: 46,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  spine: {
    position: 'absolute', left: 21, top: 12, bottom: 12,
    width: 2, borderRadius: 1,
    backgroundColor: Colors.border,
  },
  dotWrap: {
    position: 'absolute', left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.surface,
  },
  year: { fontSize: 9, color: Colors.textMuted, fontWeight: '700' },
  terminus: {
    position: 'absolute', left: 8, width: 34,
    fontSize: 9, color: Colors.textMuted, fontWeight: '700', textAlign: 'center',
  },
}); }
