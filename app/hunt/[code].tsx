/**
 * /hunt/[code] — seek a cache.
 *
 * Resolves the cache by its share code (works for not-signed-in
 * visitors), then shows the Wayfinder compass: a needle pointing at the
 * cache, live distance, and a hot/cold readout. The "I found it" button
 * unlocks only inside the find radius, and the server re-checks the
 * gate when you log the find.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHuntByCode, useClaimFind, getHuntPhotoUrl } from '../../hooks/useHunt';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useHeading } from '../../hooks/useHeading';
import { HuntMap } from '../../components/hunt/HuntMap';
import { haversine, bearing, formatDistance, temperature, withinFindGate } from '../../lib/geo';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

const TEMP_LABEL: Record<string, { t: string; c: string }> = {
  on_target: { t: 'ON TARGET', c: '#5BC289' },
  burning: { t: 'BURNING HOT', c: '#FF5A52' },
  hot: { t: 'HOT', c: '#FFB24D' },
  warm: { t: 'WARM', c: '#FFE08A' },
  cool: { t: 'COOL', c: '#6FD6FF' },
  cold: { t: 'COLD', c: Colors.textMuted },
};

export default function HuntSeek() {
  const s = makeStyles();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { data: cache, isLoading } = useHuntByCode(typeof code === 'string' ? code : null);
  const { coords, error: geoError } = useGeolocation();
  const { heading, start: startCompass } = useHeading();
  const claim = useClaimFind();
  const signedIn = useAuthStore((st) => !!st.user?.id);

  const [found, setFound] = useState(false);

  const target = cache ? { lat: cache.lat, lng: cache.lng } : null;
  const distance = coords && target ? haversine(coords, target) : null;
  const brg = coords && target ? bearing(coords, target) : 0;
  const rel = heading === null ? brg : (brg - heading + 360) % 360;
  const temp = distance !== null ? TEMP_LABEL[temperature(distance)] : null;
  const gated = distance !== null && cache ? withinFindGate(distance, cache.radius_m) : false;

  // Try to enable the compass once (Android attaches immediately; iOS
  // waits for the explicit "Enable compass" tap).
  useEffect(() => { startCompass(); }, [startCompass]);

  const photoUrl = useMemo(() => getHuntPhotoUrl(cache?.photo_path), [cache?.photo_path]);

  const onFound = async () => {
    if (!cache || !coords) return;
    if (!signedIn) {
      showAlert('Sign in to log it', 'Logging a find needs a HereToo account. You can still navigate.');
      return;
    }
    try {
      const res = await claim.mutateAsync({ cacheId: cache.id, lat: coords.lat, lng: coords.lng });
      if (res.ok) {
        setFound(true);
        if (Platform.OS === 'web' && (navigator as any).vibrate) (navigator as any).vibrate([90, 60, 90, 60, 200]);
      } else if (res.error === 'too_far') {
        showAlert('Not quite there', `You are ${res.distance_m}m away. Get closer.`);
      } else {
        showAlert('Could not log it', 'Try again.');
      }
    } catch (e: any) {
      showAlert('Could not log it', e?.message ?? 'Try again.');
    }
  };

  if (isLoading) {
    return <SafeAreaView style={s.root}><ActivityIndicator color={Colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  }
  if (!cache) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.replace('/hunt')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.kicker}>Hunt</Text>
        </View>
        <Text style={s.notFound}>No cache for code “{String(code)}”. Check the link.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.replace('/hunt')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.kicker}>{cache.title || 'Seek the cache'}</Text>
        </View>

        {found ? (
          <View style={s.foundCard}>
            <Ionicons name="checkmark-circle" size={48} color="#5BC289" />
            <Text style={s.foundTitle}>Found it</Text>
            <Text style={s.foundSub}>Logged. {cache.found_count + 1} finds so far.</Text>
            <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/hunt')} activeOpacity={0.85}>
              <Text style={s.ghostBtnText}>Back to hunts</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Compass */}
            <View style={s.scope}>
              <View style={[s.needle, { transform: [{ rotate: `${rel}deg` }] }]}>
                <View style={s.arrow} />
              </View>
              <View style={s.hub} />
            </View>

            {/* Readout */}
            <Text style={s.dist}>{distance !== null ? formatDistance(distance) : '—'}</Text>
            {temp && <Text style={[s.temp, { color: temp.c }]}>{temp.t}</Text>}
            <Text style={s.sub}>
              {heading === null ? 'Compass off · north-up' : `heading ${Math.round(heading)}°`}
              {coords ? ` · ±${Math.round(coords.accuracy)}m` : ''}
            </Text>

            {Platform.OS === 'web' && heading === null && (
              <TouchableOpacity style={s.compassBtn} onPress={startCompass} activeOpacity={0.85}>
                <Ionicons name="compass-outline" size={16} color={Colors.primary} />
                <Text style={s.compassBtnText}>Enable compass</Text>
              </TouchableOpacity>
            )}

            {/* Clue */}
            {photoUrl && <RNImage source={{ uri: photoUrl }} style={s.clue} resizeMode="cover" />}
            {!!cache.hint && <Text style={s.hint}>“{cache.hint}”</Text>}

            {/* Area map */}
            {target && <HuntMap center={target} markers={[{ id: cache.id, lat: cache.lat, lng: cache.lng, label: cache.title || 'Cache' }]} height={200} />}

            {/* Find gate */}
            <TouchableOpacity
              style={[s.findBtn, !gated && s.findBtnLocked]}
              onPress={onFound}
              disabled={!gated || claim.isPending}
              activeOpacity={0.85}
            >
              {claim.isPending
                ? <ActivityIndicator color="#FFF" />
                : <Ionicons name={gated ? 'flag' : 'lock-closed'} size={16} color={gated ? '#FFF' : Colors.textMuted} />}
              <Text style={[s.findBtnText, !gated && { color: Colors.textMuted }]}>
                {gated ? 'I found it' : distance !== null ? `Get within ${cache.radius_m}m` : 'Locating…'}
              </Text>
            </TouchableOpacity>
            {geoError === 'denied' && <Text style={s.warn}>Location blocked. Enable it to hunt.</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 520, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md, alignItems: 'stretch' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    notFound: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 60 },

    scope: {
      width: 220, height: 220, borderRadius: 110, alignSelf: 'center', marginTop: 8,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    needle: { position: 'absolute', width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
    arrow: {
      width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 80,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: Colors.primary,
      transform: [{ translateY: -22 }],
    },
    hub: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.primary },

    dist: {
      fontSize: 44, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginTop: 6,
      ...(Platform.OS === 'web' ? ({ fontFamily: 'ui-monospace, monospace' } as any) : {}),
    },
    temp: { fontSize: 14, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
    sub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
    compassBtn: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
      borderWidth: 1, borderColor: Colors.primary,
    },
    compassBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

    clue: { width: '100%', height: 200, borderRadius: Radius.lg, backgroundColor: Colors.surface, marginTop: 6 },
    hint: { fontSize: 16, fontStyle: 'italic', color: Colors.textPrimary, textAlign: 'center' },

    findBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: Radius.full, backgroundColor: Colors.primary, marginTop: 8,
    },
    findBtnLocked: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    findBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    warn: { fontSize: 13, color: '#C2604F', textAlign: 'center' },

    foundCard: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    foundTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
    foundSub: { fontSize: 15, color: Colors.textSecondary },
    ghostBtn: { paddingVertical: 12, marginTop: 8 },
    ghostBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
