/**
 * /hunt/[code] — seek a cache.
 *
 * Resolves the cache by its share code (works for not-signed-in
 * visitors), then shows the Wayfinder compass: a needle pointing at the
 * cache, live distance, and a hot/cold readout. The "I found it" button
 * unlocks only inside the find radius, and the server re-checks the
 * gate when you log the find.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHuntByCode, useClaimFind, useBurnCache, getHuntPhotoUrl } from '../../hooks/useHunt';
import { GlitchText } from '../../components/shared/GlitchText';
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
  const burn = useBurnCache();
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

  // Continuous needle angle: accumulate the shortest-arc delta so the
  // arrow never spins the long way across the 0/360 seam, and so a web
  // CSS transition can glide it smoothly. `rel` is already low-pass
  // smoothed upstream (useHeading).
  const [needleDeg, setNeedleDeg] = useState(0);
  const needleRef = useRef(0);
  useEffect(() => {
    const diff = (((rel - needleRef.current) % 360) + 540) % 360 - 180;
    needleRef.current += diff;
    setNeedleDeg(needleRef.current);
  }, [rel]);

  // The photo is the payload at the drop. Keep it hidden until the
  // seeker is physically inside the find radius (or has logged the find).
  const revealed = gated || found;

  const onFound = async () => {
    if (!cache || !coords) return;
    if (!signedIn) {
      showAlert('Sign in to log it', 'Logging a pickup needs a HereToo account. The compass still works.');
      return;
    }
    try {
      const res = await claim.mutateAsync({ cacheId: cache.id, lat: coords.lat, lng: coords.lng });
      if (res.ok) {
        setFound(true);
        if (Platform.OS === 'web' && (navigator as any).vibrate) (navigator as any).vibrate([90, 60, 90, 60, 200]);
        // Self-destructing drop: burn it now that it has been seen.
        if (cache.self_destruct) burn.mutate(cache.id);
      } else if (res.error === 'too_far') {
        showAlert('Still short', `${res.distance_m}m out. Close the distance.`);
      } else if (res.error === 'locked') {
        showAlert('Locked', 'Collect the drop before this one first.');
      } else {
        showAlert('Could not log it', 'Try it again.');
      }
    } catch (e: any) {
      showAlert('Could not log it', e?.message ?? 'Try it again.');
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
          <Text style={s.kicker}>Deaddrop</Text>
        </View>
        <Text style={s.notFound}>Nothing filed under “{String(code)}”. Check the code.</Text>
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
          <Text style={s.kicker}>{cache.title || 'Collect the drop'}</Text>
        </View>

        {cache.locked ? (
          <View style={s.foundCard}>
            <Ionicons name="lock-closed" size={44} color={Colors.textMuted} />
            <Text style={s.foundTitle}>Locked</Text>
            <Text style={s.foundSub}>
              This one runs second. Collect the drop before it, then come back.
            </Text>
            <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/hunt')} activeOpacity={0.85}>
              <Text style={s.ghostBtnText}>Back to the board</Text>
            </TouchableOpacity>
          </View>
        ) : found ? (
          <View style={s.foundCard}>
            {cache.self_destruct ? (
              <>
                {photoUrl && <RNImage source={{ uri: photoUrl }} style={[s.clue, s.burning]} resizeMode="cover" />}
                <GlitchText style={s.goneTitle}>GONE</GlitchText>
                <Text style={s.foundSub}>It burned on delivery. One look. That was the price.</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={48} color="#5BC289" />
                <Text style={s.foundTitle}>Collected</Text>
                {photoUrl && <RNImage source={{ uri: photoUrl }} style={s.clue} resizeMode="cover" />}
                <Text style={s.foundSub}>Logged. {cache.found_count + 1} pickups on this one.</Text>
              </>
            )}
            <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/hunt')} activeOpacity={0.85}>
              <Text style={s.ghostBtnText}>Back to the board</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Top half: the directional arrow ─────────────────── */}
            <View style={s.scope}>
              <View
                style={[
                  s.needle,
                  { transform: [{ rotate: `${needleDeg}deg` }] },
                  Platform.OS === 'web'
                    ? ({ transitionProperty: 'transform', transitionDuration: '140ms', transitionTimingFunction: 'ease-out' } as any)
                    : {},
                ]}
              >
                <View style={s.arrow} />
              </View>
              <View style={s.hub} />
            </View>

            <Text style={s.dist}>{distance !== null ? formatDistance(distance) : '—'}</Text>
            {temp && <Text style={[s.temp, { color: temp.c }]}>{temp.t}</Text>}
            <Text style={s.sub}>
              {heading === null ? 'compass off · north-up' : `heading ${Math.round(heading)}°`}
              {coords ? ` · ±${Math.round(coords.accuracy)}m` : ''}
            </Text>
            {!!cache.hint && <Text style={s.hint}>“{cache.hint}”</Text>}

            {Platform.OS === 'web' && heading === null && (
              <TouchableOpacity style={s.compassBtn} onPress={startCompass} activeOpacity={0.85}>
                <Ionicons name="compass-outline" size={16} color={Colors.primary} />
                <Text style={s.compassBtnText}>Wake the compass</Text>
              </TouchableOpacity>
            )}

            {/* ── Bottom half: the map with your dot + the drop ────── */}
            {target && (
              <HuntMap
                center={coords ?? target}
                markers={[{ id: cache.id, lat: cache.lat, lng: cache.lng, label: cache.title || 'Drop' }]}
                you={coords}
                height={240}
              />
            )}

            {geoError === 'denied' && <Text style={s.warn}>Location is blocked. Turn it on to run this.</Text>}

            {/* The sealed payload — hidden until inside the radius. */}
            {revealed ? (
              photoUrl
                ? <RNImage source={{ uri: photoUrl }} style={s.clue} resizeMode="cover" />
                : null
            ) : (
              <View style={s.sealed}>
                <Ionicons name="lock-closed" size={22} color={Colors.textMuted} />
                <Text style={s.sealedText}>
                  Sealed. Close to within {cache.radius_m}m and it opens.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* The find gate lives in the thumb zone: pinned above the tab
          bar while hunting, always reachable one-handed. */}
      {!found && !cache.locked && (
        <View style={s.pinned}>
          <TouchableOpacity
            style={[s.findBtn, !gated && s.findBtnLocked]}
            onPress={onFound}
            disabled={!gated || claim.isPending}
            activeOpacity={0.85}
          >
            {claim.isPending
              ? <ActivityIndicator color="#FFF" />
              : <Ionicons name={gated ? 'flag' : 'lock-closed'} size={18} color={gated ? '#FFF' : Colors.textMuted} />}
            <Text style={[s.findBtnText, !gated && { color: Colors.textMuted }]}>
              {gated ? 'I have it' : distance !== null ? `Close to ${cache.radius_m}m` : 'Taking a fix…'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 520, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 170, gap: Spacing.md, alignItems: 'stretch' },
    // Pinned above the mobile tab bar (~64px + safe area).
    pinned: {
      position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 84,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.45)', borderRadius: 999 } as any)
        : { elevation: 8 }),
    },
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

    clue: { width: '100%', height: 240, borderRadius: Radius.lg, backgroundColor: Colors.surface, marginTop: 6 },
    hint: { fontSize: 16, fontStyle: 'italic', color: Colors.textPrimary, textAlign: 'center' },
    sealed: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: Spacing.md, borderRadius: Radius.lg,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderStyle: 'dashed' as any,
    },
    sealedText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },

    findBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 16, borderRadius: Radius.full, backgroundColor: Colors.primary, marginTop: 8,
    },
    findBtnLocked: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    findBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    warn: { fontSize: 13, color: '#C2604F', textAlign: 'center' },

    foundCard: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    foundTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
    goneTitle: { fontSize: 44, fontWeight: '800', color: '#FF5A52', letterSpacing: 4 },
    burning: Platform.OS === 'web'
      ? ({
          filter: 'contrast(1.5) saturate(0.2) hue-rotate(80deg)',
          animation: 'ht-glitch 0.32s steps(2) infinite',
          opacity: 0.8,
        } as any)
      : { opacity: 0.6 },
    foundSub: { fontSize: 15, color: Colors.textSecondary },
    ghostBtn: { paddingVertical: 12, marginTop: 8 },
    ghostBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
