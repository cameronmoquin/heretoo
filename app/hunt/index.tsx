/**
 * /hunt — the deaddrop board.
 *
 * Set one, or pick an open run to collect. Your own drops list with the
 * destination they landed at plus the share code, so the courier link is
 * always one tap away.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyHuntCaches, usePublicHuntCaches, useNearbyCaches, useDeleteHuntCache,
  huntUrl, type HuntCache,
} from '../../hooks/useHunt';
import { useGeolocation } from '../../hooks/useGeolocation';
import { showAlert, showConfirm } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { RailCard } from '../../components/shared/RailCard';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, Type } from '../../constants/design';
import { Vocab } from '../../constants/vocab';

/** hunt_caches.scope reads back as the destination it was sent to. */
function destinationLabel(scope: HuntCache['scope']): string {
  if (scope === 'public') return 'Public';
  if (scope === 'family') return Vocab.Group;
  return 'DM';
}

function pickupLine(n: number): string {
  return `${n} ${n === 1 ? 'pickup' : 'pickups'}`;
}

const RADII = [1, 5, 10, 25];

export default function HuntHome() {
  const s = makeStyles();
  const { data: mine } = useMyHuntCaches();
  const { data: pub } = usePublicHuntCaches();
  const { coords, error: geoError } = useGeolocation();
  const [radiusMiles, setRadiusMiles] = useState(5);
  const { data: nearby, isLoading: nearbyLoading } = useNearbyCaches(coords, radiusMiles);
  const removeCache = useDeleteHuntCache();

  const onDelete = (c: HuntCache) => {
    showConfirm(
      'Delete this drop?',
      'The X disappears from every feed card pointing at it, and its pickups go with it.',
      () => removeCache.mutate(c.id, {
        onError: (e: any) => showAlert('Could not delete', e?.message ?? 'Try again.'),
      }),
      'Delete', 'Cancel',
    );
  };

  const shareCache = async (c: HuntCache) => {
    if (!c.share_code) return;
    const url = huntUrl(c.share_code);
    try {
      if (Platform.OS !== 'web' && (Share as any)?.share) {
        await Share.share({ message: `I left something. Come collect it: ${url}` });
      } else if (typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(url);
        showAlert('Link copied', url);
      } else {
        showAlert('Courier link', url);
      }
    } catch {}
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader showBack style={s.header} />
        <Text style={s.title}>DEADDROP</Text>

        <Text style={s.lede}>
          Leave a photo at a fixed set of coordinates. It lands in the feed.
          The payload stays shut until someone stands on it.
        </Text>

        <Button
          title="Set a drop"
          onPress={() => router.push('/hunt/new')}
          size="lg"
          icon={<Ionicons name="add-circle" size={18} color={Colors.onPrimary} />}
        />

        {/* What is out there, measured from where you stand. Public
            drops for anyone; cohort drops for members; link drops never
            surface — a link is an invitation, not a listing. */}
        <View style={s.section}>
          <Eyebrow>Nearby</Eyebrow>
          <View style={s.radiusRow}>
            {RADII.map((r) => (
              <Text
                key={r}
                onPress={() => setRadiusMiles(r)}
                style={[s.radiusChip, radiusMiles === r && s.radiusChipOn]}
                accessibilityRole="button"
                accessibilityLabel={`Within ${r} ${r === 1 ? 'mile' : 'miles'}`}
              >
                {r} mi
              </Text>
            ))}
          </View>
          {geoError === 'denied' ? (
            <Text style={s.empty}>Location is blocked. Turn it on to search.</Text>
          ) : !coords ? (
            <Text style={s.empty}>Taking a fix…</Text>
          ) : nearbyLoading ? (
            <Text style={s.empty}>Sweeping…</Text>
          ) : (nearby ?? []).length === 0 ? (
            <Text style={s.empty}>Nothing within {radiusMiles} {radiusMiles === 1 ? 'mile' : 'miles'}.</Text>
          ) : (
            (nearby ?? []).map((c) => (
              <RailCard
                key={c.id}
                accentColor={Colors.bridge}
                eyebrow={c.distance_miles < 0.1 ? 'Right here' : `${c.distance_miles.toFixed(1)} mi`}
                onPress={() => c.share_code && router.push(`/hunt/${c.share_code}`)}
                accessibilityLabel={`Collect ${c.title || 'unmarked drop'}, ${c.distance_miles.toFixed(1)} miles away.`}
              >
                <Text style={s.rowTitle}>{c.title || 'Unmarked drop'}</Text>
                <Text style={s.rowMeta}>
                  {(c.creator_name || c.creator_handle) ? `${c.creator_name ?? `@${c.creator_handle}`} · ` : ''}
                  {pickupLine(c.found_count)}{c.has_payload ? ' · sealed payload' : ''}
                </Text>
              </RailCard>
            ))
          )}
        </View>

        {/* Your own drops */}
        {(mine ?? []).length > 0 && (
          <View style={s.section}>
            <Eyebrow>Your drops</Eyebrow>
            {(mine ?? []).map((c) => (
              <RailCard key={c.id} eyebrow={destinationLabel(c.scope)}>
                <Text style={s.rowTitle}>{c.title || 'Unmarked drop'}</Text>
                <Text style={s.rowMeta}>
                  Code {c.share_code} · {pickupLine(c.found_count)}
                </Text>
                <View style={s.actions}>
                  <Button
                    title="Share"
                    onPress={() => shareCache(c)}
                    variant="ghost"
                    size="sm"
                    icon={<Ionicons name="share-outline" size={16} color={Colors.primary} />}
                  />
                  <Button
                    title="Collect"
                    onPress={() => router.push(`/hunt/${c.share_code}`)}
                    variant="ghost"
                    size="sm"
                    icon={<Ionicons name="navigate-outline" size={16} color={Colors.primary} />}
                  />
                  <Button
                    title="Delete"
                    onPress={() => onDelete(c)}
                    variant="ghost"
                    size="sm"
                    icon={<Ionicons name="trash-outline" size={16} color={Colors.textMuted} />}
                  />
                </View>
              </RailCard>
            ))}
          </View>
        )}

        {/* Public drops anyone can run */}
        <View style={s.section}>
          <Eyebrow>Open runs</Eyebrow>
          {(pub ?? []).length === 0 ? (
            <Text style={s.empty}>Nothing on the open board.</Text>
          ) : (
            (pub ?? []).map((c) => (
              <RailCard
                key={c.id}
                accentColor={Colors.bridge}
                eyebrow="Drop"
                onPress={() => router.push(`/hunt/${c.share_code}`)}
                accessibilityLabel={`Collect ${c.title || 'unmarked drop'}. ${pickupLine(c.found_count)}.`}
              >
                <Text style={s.rowTitle}>{c.title || 'Unmarked drop'}</Text>
                <Text style={s.rowMeta}>{pickupLine(c.found_count)}</Text>
              </RailCard>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },
    header: { paddingHorizontal: 0 },
    radiusRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
    radiusChip: {
      paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: 999, overflow: 'hidden' as const,
      borderWidth: 1, borderColor: Colors.border,
      color: Colors.textSecondary, fontSize: Type.caption.size, fontWeight: '600' as const,
    },
    radiusChipOn: {
      borderColor: Colors.primary, color: Colors.primary,
      backgroundColor: Colors.primaryFaint,
    },
    title: {
      fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
      fontWeight: '800', color: Colors.primary, letterSpacing: 2,
    },
    lede: { fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textPrimary },
    section: { gap: Spacing.xs },
    rowTitle: {
      fontSize: Type.cardTitle.size, lineHeight: Type.cardTitle.lineHeight,
      fontWeight: Type.cardTitle.weight, color: Colors.textPrimary,
    },
    rowMeta: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textMuted },
    actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xxs },
    empty: { fontSize: Type.ui.size, color: Colors.textSecondary, fontStyle: 'italic' },
  });
}
