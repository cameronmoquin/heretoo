/**
 * Room — the default surface of HereToo (Source of Truth, Milestone 1).
 *
 * Replaces the feed as the front door. The feed still exists at /common
 * and per-family pages still exist; the Room is what the user sees
 * when they open the app.
 *
 * Three zones, top to bottom:
 *   - Hearth: family/today masthead, day-of-week, room-switcher swatches.
 *   - Mantel: up to three Postcards from the (per-family or unifying) feed.
 *   - Side table: music station card, "read me today" affordance, compose.
 *
 * On mobile the three zones still stack, but the hearth is single-line
 * and the side table becomes a low-profile bottom dock.
 *
 * Empty state: "Quiet day. Last post was [N days] ago." plus a single
 * subdued action. No exclamation marks, no nudges, no invitation to
 * "create more content."
 *
 * The Room is the dwelling. The feed is the fallback.
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFeed } from '../../hooks/useFeed';
import { useFamilyFeed, useMyFamilies } from '../../hooks/useFamily';
import { useRadio, useActiveStation } from '../../stores/radioStore';
import { useTTS } from '../../stores/ttsStore';
import { useTodayDispatch } from '../../hooks/useDispatch';
import { useWallpaper, WALLPAPERS } from '../../stores/wallpaperStore';
import { Postcard } from './Postcard';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

interface Props {
  /** When set, the Room is scoped to this single family.
   *  When null/undefined, it is the Common Room — cross-family. */
  familyId?: string | null;
  /** Family name shown in the hearth when scoped. */
  familyName?: string | null;
}

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function Room({ familyId, familyName }: Props) {
  const s = makeStyles();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;

  // Source the mantel postcards. Common Room uses the unifying ranker
  // (paginated useInfiniteQuery); family-scoped Room uses the family's
  // own feed (flat useQuery). Both hooks self-gate on their inputs;
  // we simply read whichever is relevant.
  const commonFeed = useFeed('for_you');
  const familyFeed = useFamilyFeed(familyId ?? null);
  const posts = familyId
    ? (familyFeed.data ?? [])
    : (commonFeed.data?.pages?.flat() ?? []);
  const isLoading = familyId ? familyFeed.isLoading : commonFeed.isLoading;
  const mantelPosts = (posts as any[]).slice(0, 3);

  // Side-table state: music + read-aloud + compose
  const radioPlaying = useRadio((r) => r.playing);
  const radioToggle = useRadio((r) => r.toggle);
  const station = useActiveStation();
  const tts = useTTS();
  const wallpaperId = useWallpaper((w) => w.id);
  const wallpaper = WALLPAPERS[wallpaperId as keyof typeof WALLPAPERS];

  const { data: families } = useMyFamilies();
  const familySwatches = (families ?? []) as Array<{ id: string; name: string }>;

  // Today's "candle on the mantel" — Anniversary Engine output.
  // Filtered server-side to the viewer's timezone. The hearth shows
  // the first; the digest will list all of them once wired.
  const { data: dispatches } = useTodayDispatch();
  const candle = (dispatches ?? [])[0];

  const today = useMemo(() => {
    const now = new Date();
    return {
      day: DAY_NAMES[now.getDay()],
      date: now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
    };
  }, []);

  // "Read me today" — reads each mantel post sequentially. Falls back
  // to a quiet no-op if there's nothing on the mantel. M6 will turn
  // this into a chained, music-ducking ambient experience; for now it
  // reads the first post and lets the user tap each subsequent one.
  const onReadToday = () => {
    const first = mantelPosts[0];
    if (first?.body) tts.toggle(first.id, first.body);
  };

  // Compose flow — for v1 this opens the existing post composer.
  // M5 (The Letter) will add a sibling "Write a letter" affordance.
  const onCompose = () => {
    if (familyId) {
      router.push(`/family/${familyId}` as any);
    } else {
      router.push('/feed' as any);
    }
  };

  const lastPostAge = mantelPosts[0]?.created_at
    ? daysAgo(mantelPosts[0].created_at as string)
    : null;

  return (
    <SafeAreaView style={s.root} edges={isCompact ? ['top'] : []}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hearth ───────────────────────────────────────────────── */}
        <View style={[s.hearth, isCompact && s.hearthCompact]}>
          <View style={s.hearthMast}>
            <Text style={s.hearthTitle} numberOfLines={1}>
              {familyId ? (familyName ?? 'Family') : 'Today'}
            </Text>
            <Text style={s.hearthSub}>
              {today.day} · {today.date}
            </Text>
            {/* The candle on the mantel — Anniversary Engine dispatch.
                One sentence. Stays quiet when nothing is to be noticed. */}
            {!!candle && (
              <TouchableOpacity
                style={s.candle}
                activeOpacity={0.75}
                onPress={() => {
                  if (candle.source_post_id) {
                    router.push(`/feed/${candle.source_post_id}` as any);
                  }
                }}
              >
                <View style={s.candleDot} />
                <Text style={s.candleText} numberOfLines={3}>{candle.copy}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Room switcher: Common + each family swatch.
              Tapping a family routes to its page (the family page
              IS the per-family Room in this iteration). */}
          {familySwatches.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.switcher}
            >
              <Swatch
                label="Common"
                active={!familyId}
                wallpaperLabel={wallpaper?.label ?? 'Plain'}
                onPress={() => router.replace('/' as any)}
              />
              {familySwatches.map((f) => (
                <Swatch
                  key={f.id}
                  label={f.name}
                  active={f.id === familyId}
                  onPress={() => router.replace(`/family/${f.id}` as any)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─── Mantel ───────────────────────────────────────────────── */}
        <View style={s.mantel}>
          {isLoading && mantelPosts.length === 0 ? (
            <Text style={s.empty}>…</Text>
          ) : mantelPosts.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.empty}>Quiet day.</Text>
              <Text style={s.emptySub}>
                {lastPostAge !== null
                  ? `Last post was ${lastPostAge} ${lastPostAge === 1 ? 'day' : 'days'} ago.`
                  : 'Nothing posted yet.'}
              </Text>
              <TouchableOpacity onPress={onCompose} style={s.emptyAction} activeOpacity={0.7}>
                <Text style={s.emptyActionText}>Write something</Text>
              </TouchableOpacity>
            </View>
          ) : (
            mantelPosts.map((p) => <Postcard key={p.id} post={p as any} />)
          )}
        </View>

        {/* ─── Side table ───────────────────────────────────────────── */}
        <View style={s.sideTable}>
          {/* Music station card */}
          <TouchableOpacity
            style={s.musicCard}
            onPress={() => { radioToggle().catch(() => {}); }}
            onLongPress={() => router.push('/(tabs)/music' as any)}
            activeOpacity={0.85}
          >
            <View style={s.musicIcon}>
              <Ionicons
                name={radioPlaying ? 'pause' : 'play'}
                size={18}
                color={Colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.musicTitle} numberOfLines={1}>{station.name}</Text>
              <Text style={s.musicSub} numberOfLines={1}>
                {radioPlaying ? 'Now playing' : station.genre}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Read-aloud */}
          <TouchableOpacity
            style={[s.dockBtn, mantelPosts.length === 0 && { opacity: 0.4 }]}
            onPress={onReadToday}
            disabled={mantelPosts.length === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="volume-medium-outline" size={18} color={Colors.textSecondary} />
            <Text style={s.dockBtnText}>Read me today</Text>
          </TouchableOpacity>

          {/* Compose */}
          <TouchableOpacity
            style={[s.dockBtn, s.dockBtnPrimary]}
            onPress={onCompose}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
            <Text style={[s.dockBtnText, { color: '#FFF', fontWeight: '700' }]}>Compose</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Swatch({
  label, active, onPress, wallpaperLabel,
}: {
  label: string; active?: boolean; onPress: () => void; wallpaperLabel?: string;
}) {
  const s = makeStyles();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.swatch, active && s.swatchActive]}
      activeOpacity={0.75}
    >
      <View style={[s.swatchDot, active && { backgroundColor: Colors.primary }]} />
      <Text style={[s.swatchLabel, active && { color: Colors.primary, fontWeight: '700' }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function daysAgo(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function makeStyles() { return StyleSheet.create({
  // Transparent wrapper — the wallpaper bleeds through to the gutters.
  root: {
    flex: 1, backgroundColor: 'transparent',
    maxWidth: 720, alignSelf: 'center', width: '100%',
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },

  // Hearth
  hearth: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  hearthCompact: { paddingVertical: Spacing.sm },
  hearthMast: { gap: 2 },
  hearthTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  hearthSub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },

  // Candle dispatch — single-sentence "rhythm" line, set apart from
  // the masthead with a subtle gold dot, never an exclamation.
  candle: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 12,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderLeftWidth: 2, borderLeftColor: Colors.primary,
  },
  candleDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  candleText: {
    flex: 1,
    fontSize: 13, lineHeight: 19,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Room switcher swatches
  switcher: { gap: 8, paddingRight: 24 },
  swatch: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  swatchActive: {
    backgroundColor: Colors.primaryFaint,
    borderColor: Colors.primary,
  },
  swatchDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  swatchLabel: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary, maxWidth: 120 },

  // Mantel
  mantel: { gap: 0, minHeight: 120 },
  empty: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  emptyWrap: {
    paddingVertical: Spacing.xl,
    gap: 6,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  emptyAction: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.primary,
  },
  emptyActionText: {
    fontSize: 13, fontWeight: '600', color: Colors.primary, letterSpacing: 0.1,
  },

  // Side table
  sideTable: {
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  musicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  musicIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  musicTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  musicSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  dockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    justifyContent: 'center',
  },
  dockBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dockBtnText: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.1,
  },
}); }
