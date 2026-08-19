/**
 * /hunt/[code] — collect a deaddrop.
 *
 * Resolves the drop by its share code (works for not-signed-in
 * visitors), then shows the Wayfinder: a needle pointing at the drop,
 * live distance, and a hot/cold readout. The payload stays sealed until
 * the seeker is physically inside the find radius, and the server
 * re-checks the gate when the find is logged.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHuntByCode, useClaimFind, useBurnCache, getHuntPhotoUrl, usePayloadUrl } from '../../hooks/useHunt';
import { Button } from '../../components/shared/Button';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useHeading } from '../../hooks/useHeading';
import { HuntMap } from '../../components/hunt/HuntMap';
import { haversine, bearing, formatDistance, temperature, withinFindGate } from '../../lib/geo';
import { useAuthStore } from '../../stores/authStore';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Type, Heights, Radius } from '../../constants/design';

const SCOPE_SIZE = 220;

/**
 * Temperature readout. Built per render: the cold label sits on
 * Colors.textMuted, and a module-level constant would freeze that at the
 * theme the bundle happened to load with.
 *
 * HOT and WARM stay literal. The ramp needs six steps that stay apart,
 * and the palette carries exactly one amber (warning and important are
 * the same value), so snapping both would collapse two rungs into one.
 */
function tempLabels(): Record<string, { t: string; c: string }> {
  return {
    on_target: { t: 'ON TARGET', c: Colors.success },
    burning: { t: 'BURNING HOT', c: Colors.error },
    hot: { t: 'HOT', c: '#FFB24D' },
    warm: { t: 'WARM', c: '#FFE08A' },
    cool: { t: 'COOL', c: Colors.info },
    cold: { t: 'COLD', c: Colors.textMuted },
  };
}

export default function HuntSeek() {
  const s = makeStyles();
  const labels = tempLabels();
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
  const temp = distance !== null ? labels[temperature(distance)] : null;
  const gated = distance !== null && cache ? withinFindGate(distance, cache.radius_m) : false;

  // Try to enable the compass once (Android attaches immediately; iOS
  // waits for the explicit "Wake the compass" tap).
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

  // The TRUE payload (090): private bucket, and the claim is the key —
  // the signed URL only resolves once this seeker's hunt_finds row
  // exists, so it is not even requested before then. Legacy drops keep
  // their public clue photo via photoUrl below.
  const payload = usePayloadUrl(found ? (cache as any)?.payload_photo_path : null);
  const payloadUrl = payload.data ?? null;

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
        <ScreenHeader title="Deaddrop" showBack onBack={() => router.replace('/hunt')} style={s.header} />
        <Text style={s.notFound}>Nothing filed under “{String(code)}”. Check the code.</Text>
      </SafeAreaView>
    );
  }

  const findLabel = gated
    ? 'I have it'
    : distance !== null ? `Close to ${cache.radius_m}m` : 'Taking a fix';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={cache.title || 'Collect the drop'}
          showBack
          onBack={() => router.replace('/hunt')}
          style={s.header}
        />

        {cache.locked ? (
          <View style={s.foundCard}>
            <Ionicons name="lock-closed" size={44} color={Colors.textMuted} />
            <Text style={s.foundTitle}>Locked</Text>
            <Text style={s.foundSub}>
              This one runs second. Collect the drop before it, then come back.
            </Text>
            <Button title="Back to the board" onPress={() => router.replace('/hunt')} variant="ghost" />
          </View>
        ) : found ? (
          <View style={s.foundCard}>
            {cache.self_destruct ? (
              <>
                {(payloadUrl ?? photoUrl) && <RNImage source={{ uri: (payloadUrl ?? photoUrl)! }} style={[s.clue, s.burning]} resizeMode="cover" />}
                <Text style={s.goneTitle}>GONE</Text>
                <Text style={s.foundSub}>It burned on delivery. One look. That was the price.</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
                <Text style={s.foundTitle}>Collected</Text>
                {(payloadUrl ?? photoUrl) && <RNImage source={{ uri: (payloadUrl ?? photoUrl)! }} style={s.clue} resizeMode="cover" />}
                <Text style={s.foundSub}>Logged. {cache.found_count + 1} pickups on this one.</Text>
              </>
            )}
            <Button title="Back to the board" onPress={() => router.replace('/hunt')} variant="ghost" />
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
            {!!((cache as any).creator_name || (cache as any).creator_handle) && (
              <Text style={s.sub}>
                left by {(cache as any).creator_name ?? `@${(cache as any).creator_handle}`}
              </Text>
            )}

            {Platform.OS === 'web' && heading === null && (
              <Button
                title="Wake the compass"
                onPress={startCompass}
                variant="outline"
                size="sm"
                style={s.compassBtn}
                icon={<Ionicons name="compass-outline" size={16} color={Colors.textPrimary} />}
              />
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
          bar while hunting, always reachable one-handed. Kept bespoke
          rather than a shared Button: the locked state has to stay
          fully legible, since it carries the remaining distance. */}
      {!found && !cache.locked && (
        <View style={s.pinned}>
          <Pressable
            style={[s.findBtn, !gated && s.findBtnLocked]}
            onPress={onFound}
            disabled={!gated || claim.isPending}
            accessibilityRole="button"
            accessibilityLabel={findLabel}
            accessibilityState={{ disabled: !gated || claim.isPending, busy: claim.isPending }}
          >
            {claim.isPending
              ? <ActivityIndicator color={Colors.onPrimary} />
              : <Ionicons name={gated ? 'flag' : 'lock-closed'} size={18} color={gated ? Colors.onPrimary : Colors.textMuted} />}
            <Text style={[s.findBtnText, !gated && { color: Colors.textMuted }]}>{findLabel}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 520, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 170, gap: Spacing.sm, alignItems: 'stretch' },
    header: { paddingHorizontal: 0 },
    // Pinned above the mobile tab bar (~64px + safe area).
    pinned: {
      position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: 84,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.45)', borderRadius: Radius.full } as any)
        : { elevation: 8 }),
    },
    notFound: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
      color: Colors.textSecondary, textAlign: 'center', marginTop: 60,
    },

    scope: {
      width: SCOPE_SIZE, height: SCOPE_SIZE, borderRadius: SCOPE_SIZE / 2,
      alignSelf: 'center', marginTop: Spacing.xs,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    needle: {
      position: 'absolute', width: SCOPE_SIZE, height: SCOPE_SIZE,
      alignItems: 'center', justifyContent: 'center',
    },
    arrow: {
      width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 80,
      borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: Colors.primary,
      transform: [{ translateY: -22 }],
    },
    hub: {
      width: 18, height: 18, borderRadius: Radius.full,
      backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.primary,
    },

    dist: {
      fontSize: Type.hero.size, lineHeight: Type.hero.lineHeight, fontWeight: '800',
      color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.xxs,
      ...(Platform.OS === 'web' ? ({ fontFamily: 'ui-monospace, monospace' } as any) : {}),
    },
    temp: { fontSize: Type.ui.size, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
    sub: { fontSize: Type.caption.size, color: Colors.textMuted, textAlign: 'center' },
    compassBtn: { alignSelf: 'center' },

    clue: {
      width: '100%', height: 240, borderRadius: Radius.control,
      backgroundColor: Colors.surface, marginTop: Spacing.xxs,
    },
    hint: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
      fontStyle: 'italic', color: Colors.textPrimary, textAlign: 'center',
    },
    sealed: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
      padding: Spacing.sm, borderRadius: Radius.control,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
      borderStyle: 'dashed' as any,
    },
    sealedText: {
      flex: 1, fontSize: Type.ui.size, color: Colors.textSecondary, fontStyle: 'italic',
    },

    findBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
      minHeight: Heights.buttonLg, paddingVertical: Spacing.md,
      borderRadius: Radius.full, backgroundColor: Colors.primary, marginTop: Spacing.xs,
    },
    findBtnLocked: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    findBtnText: { color: Colors.onPrimary, fontSize: Type.body.size, fontWeight: '800' },
    warn: { fontSize: Type.ui.size, color: Colors.error, textAlign: 'center' },

    foundCard: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xl },
    foundTitle: {
      fontSize: Type.display.size, lineHeight: Type.display.lineHeight,
      fontWeight: '800', color: Colors.textPrimary,
    },
    goneTitle: {
      fontSize: Type.hero.size, lineHeight: Type.hero.lineHeight,
      fontWeight: '800', color: Colors.error, letterSpacing: 4,
    },
    burning: Platform.OS === 'web'
      ? ({
          filter: 'contrast(1.5) saturate(0.2) hue-rotate(80deg)',
          animation: 'ht-glitch 0.32s steps(2) infinite',
          opacity: 0.8,
        } as any)
      : { opacity: 0.6 },
    foundSub: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight, color: Colors.textSecondary,
    },
  });
}
