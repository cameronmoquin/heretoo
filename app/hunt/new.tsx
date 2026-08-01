/**
 * /hunt/new — set a deaddrop.
 *
 * A deaddrop is a drop with a GPS lock. Take the payload, fix the
 * coordinates, choose where it lands, publish. It goes into the feed at
 * the chosen destination like any drop, and stays sealed until the
 * finder physically stands on it.
 *
 * COORDINATES. A live browser fix is used when there is one. When there
 * is not (permission denied, no sensor, no HTTPS), the author sets the
 * pin by tapping the map or typing the pair. A deaddrop still needs
 * coordinates, so the requirement stands. The path to them does not
 * depend on the browser saying yes.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateHuntCache, useUploadHuntPhoto, useMyHuntCaches, useAnnounceHuntDrop,
  huntScopeFor, huntUrl, type HuntDestination,
} from '../../hooks/useHunt';
import { useMyFamilies, useMyConnections } from '../../hooks/useFamily';
import { useGeolocation } from '../../hooks/useGeolocation';
import { HuntMap } from '../../components/hunt/HuntMap';
import { showAlert } from '../../lib/alert';
import { Button } from '../../components/shared/Button';
import { Chip } from '../../components/shared/Chip';
import { Eyebrow } from '../../components/shared/Eyebrow';
import { ScreenHeader } from '../../components/shared/ScreenHeader';
import { Colors } from '../../constants/colors';
import { Spacing, Type, Heights, Radius } from '../../constants/design';
import { Gen } from '../../constants/generations';
import { Vocab } from '../../constants/vocab';
import type { LatLng } from '../../lib/geo';

/** Until a fix or a pin lands, the map opens on the US centroid. */
const CENTROID: LatLng = { lat: 39.8283, lng: -98.5795 };

function genId(): string {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

/** Parse a typed coordinate pair. Anything out of range reads as unset. */
function parsePair(latText: string, lngText: string): LatLng | null {
  const lat = parseFloat(latText);
  const lng = parseFloat(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function HuntNew() {
  const s = makeStyles();
  const { coords, error: geoError } = useGeolocation();
  const create = useCreateHuntCache();
  const upload = useUploadHuntPhoto();
  const announce = useAnnounceHuntDrop();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [radius, setRadius] = useState('25');
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [prereqId, setPrereqId] = useState<string | null>(null);
  const { data: myCaches } = useMyHuntCaches();
  const [result, setResult] = useState<{ code: string; line: string } | null>(null);

  // The pin, typed or tapped. One source of truth: the two strings.
  // fromMap tracks which hand set them, and only that decides whether the
  // map recenters.
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [fromMap, setFromMap] = useState(false);
  const manualPin = useMemo(() => parsePair(latText, lngText), [latText, lngText]);
  const usingManual = !!manualPin;
  const typedPin = fromMap ? null : manualPin;

  // A hand-set pin wins over the live fix. With no pin set, the fix
  // carries it. With neither, the button waits on coordinates and says so.
  const placed: LatLng | null = manualPin ?? coords ?? null;

  // Destination. Same three a drop has.
  const [destination, setDestination] = useState<HuntDestination>('crew');
  const [crewId, setCrewId] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const { data: crewsRaw } = useMyFamilies();
  const { data: peopleRaw } = useMyConnections();
  const crews = crewsRaw ?? [];
  const people = peopleRaw ?? [];
  const hasCrew = crews.length > 0;
  const hasPeople = people.length > 0;

  // Crew and DM are destinations, not permissions. When you belong to no
  // crew, crew is simply not on the row, and the choice falls to public.
  const dest: HuntDestination =
    (destination === 'crew' && !hasCrew) || (destination === 'dm' && !hasPeople)
      ? 'public'
      : destination;
  const activeCrewId = crewId ?? crews[0]?.id ?? null;

  const busy = create.isPending || upload.isPending || announce.isPending;
  const destReady =
    dest === 'crew' ? !!activeCrewId : dest === 'dm' ? !!recipientId : true;
  const ready = !!placed && !!file && destReady && !busy;

  const onPickFile = (evt: any) => {
    const f: File | undefined = evt?.target?.files?.[0];
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onPickPoint = (p: LatLng) => {
    setFromMap(true);
    setLatText(p.lat.toFixed(6));
    setLngText(p.lng.toFixed(6));
  };

  const onTypeLat = (v: string) => { setFromMap(false); setLatText(v); };
  const onTypeLng = (v: string) => { setFromMap(false); setLngText(v); };

  const clearPin = () => { setFromMap(false); setLatText(''); setLngText(''); };

  const recipientName = (id: string | null) => {
    const p = people.find((c) => c.id === id);
    return p?.display_name ?? (p?.handle ? `@${p.handle}` : 'them');
  };

  const destinationLine = () => {
    if (dest === 'public') return 'Public feed.';
    if (dest === 'crew') {
      const c = crews.find((f) => f.id === activeCrewId);
      return `${c?.name ?? Vocab.Group} feed.`;
    }
    return `Sent to ${recipientName(recipientId)}.`;
  };

  const onDrop = async () => {
    if (!placed || !file) return;
    try {
      const id = genId();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const photoPath = await upload.mutateAsync({ cacheId: id, file, kind: 'clue', ext });
      const cache = await create.mutateAsync({
        id,
        title, hint,
        lat: placed.lat, lng: placed.lng,
        // A hand-set pin has no measured accuracy. Do not invent one.
        accuracyM: usingManual ? undefined : coords?.accuracy,
        radiusM: Math.max(5, parseInt(radius, 10) || 25),
        photoPath,
        scope: huntScopeFor(dest),
        familyId: dest === 'crew' ? activeCrewId : null,
        selfDestruct,
        prerequisiteCacheId: prereqId,
      });

      const code = cache.share_code || '';
      const line = destinationLine();

      // The cache is written. The feed card is a second write, so a
      // failure there costs the card and not the drop.
      if (code) {
        try {
          await announce.mutateAsync({
            shareCode: code,
            title, hint,
            destination: dest,
            familyId: dest === 'crew' ? activeCrewId : null,
            recipientId: dest === 'dm' ? recipientId : null,
          });
        } catch (e: any) {
          showAlert(
            'The drop landed. The feed card failed.',
            e?.message ?? 'Send the code by hand.',
          );
        }
      }
      setResult({ code, line });
    } catch (e: any) {
      showAlert('The drop did not land', e?.message ?? 'Try it again.');
    }
  };

  const copyLink = async () => {
    if (!result?.code) return;
    const url = huntUrl(result.code);
    try {
      await (navigator as any).clipboard?.writeText(url);
      showAlert('Link copied', url);
    } catch { showAlert('Courier link', url); }
  };

  // A typed pair recenters, because the author cannot see what they just
  // typed. A tap does not, because they can already see where they tapped
  // and the view must not lurch out from under the hand.
  const center = useMemo(
    () => typedPin ?? coords ?? CENTROID,
    [typedPin?.lat, typedPin?.lng, coords?.lat, coords?.lng],
  );

  // ── Success state ───────────────────────────────────────────────────
  if (result) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Eyebrow accentColor={Colors.primary}>Drop is live</Eyebrow>
          <Text style={s.successCode}>{result.code}</Text>
          <Text style={s.successLine}>{result.line}</Text>
          <Text style={s.successHint}>
            Send the code or the link. It buys a bearing and a distance.
            The legwork is theirs.
          </Text>
          <Button
            title="Collect it now"
            onPress={() => router.replace(`/hunt/${result.code}`)}
            size="lg"
            icon={<Ionicons name="navigate" size={16} color={Colors.onPrimary} />}
          />
          <Button
            title="Copy the courier link"
            onPress={copyLink}
            variant="outline"
            size="lg"
            icon={<Ionicons name="link" size={16} color={Colors.textPrimary} />}
          />
          <Button title="Back to the board" onPress={() => router.replace('/hunt')} variant="ghost" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Set a drop" showBack style={s.header} />

        {/* Payload */}
        <Eyebrow>The payload</Eyebrow>
        {previewUrl ? (
          <RNImage source={{ uri: previewUrl }} style={s.preview} resizeMode="cover" />
        ) : (
          <View style={s.previewEmpty}>
            <Ionicons name="camera-outline" size={28} color={Colors.textMuted} />
          </View>
        )}
        {Platform.OS === 'web' ? (
          <label style={({
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            minHeight: Heights.touchTarget, boxSizing: 'border-box',
            padding: '10px 16px', background: Colors.surface, color: Colors.textPrimary,
            border: `1px solid ${Colors.border}`, borderRadius: Gen.radius, cursor: 'pointer',
            fontWeight: 600, fontSize: Type.ui.size,
          } as any)}>
            {file ? 'Swap the photo' : 'Take or pick the photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickFile}
              aria-label="Take or pick the photo"
              style={({ display: 'none' } as any)}
            />
          </label>
        ) : (
          <Text style={s.note}>Setting a drop runs from the web app for now.</Text>
        )}

        {/* Destination. Where the drop lands. */}
        <Eyebrow>Destination</Eyebrow>
        <View style={s.chipRow}>
          <Chip label="Public" selected={dest === 'public'} onPress={() => setDestination('public')} />
          {hasCrew && (
            <Chip label={Vocab.Group} selected={dest === 'crew'} onPress={() => setDestination('crew')} />
          )}
          {hasPeople && (
            <Chip label="DM" selected={dest === 'dm'} onPress={() => setDestination('dm')} />
          )}
        </View>

        {dest === 'crew' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {crews.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={activeCrewId === c.id}
                onPress={() => setCrewId(c.id)}
              />
            ))}
          </ScrollView>
        )}

        {dest === 'dm' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {people.map((p) => (
              <Chip
                key={p.id}
                label={p.display_name ?? (p.handle ? `@${p.handle}` : 'someone')}
                selected={recipientId === p.id}
                onPress={() => setRecipientId(p.id)}
              />
            ))}
          </ScrollView>
        )}

        {/* Coordinates */}
        <Eyebrow>The coordinates</Eyebrow>
        <HuntMap
          center={center}
          pin={placed}
          you={coords}
          onPick={onPickPoint}
          zoom={coords ? 15 : 4}
          height={220}
        />
        <Text style={s.coordLine}>
          {usingManual
            ? `Pin by hand. ${manualPin!.lat.toFixed(5)}, ${manualPin!.lng.toFixed(5)}`
            : coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · ±${Math.round(coords.accuracy)}m`
              : geoError === 'denied'
                ? 'Location is blocked. Tap the map to set the pin.'
                : geoError === 'unsupported'
                  ? 'This device has no location to give. Tap the map to set the pin.'
                  : 'Taking a fix. Tap the map to set the pin.'}
        </Text>

        <View style={s.rowSplit}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Lat</Eyebrow>
            <TextInput
              style={s.input}
              accessibilityLabel="Latitude"
              value={latText}
              onChangeText={onTypeLat}
              placeholder="41.82399"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={12}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow>Lng</Eyebrow>
            <TextInput
              style={s.input}
              accessibilityLabel="Longitude"
              value={lngText}
              onChangeText={onTypeLng}
              placeholder="-71.41283"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={13}
            />
          </View>
        </View>
        {usingManual && !!coords && (
          <Button title="Use my fix" onPress={clearPin} variant="ghost" size="sm" style={s.selfStart} />
        )}

        {/* Details */}
        <Eyebrow>Title</Eyebrow>
        <TextInput
          style={s.input}
          accessibilityLabel="Drop title"
          value={title}
          onChangeText={setTitle}
          placeholder="The bent oak behind the lot"
          placeholderTextColor={Colors.textMuted}
          maxLength={80}
        />
        <Eyebrow>Hint (optional)</Eyebrow>
        <TextInput
          style={[s.input, { minHeight: 70 }]}
          accessibilityLabel="Hint"
          value={hint}
          onChangeText={setHint}
          placeholder="Low. Behind the roots."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={200}
          textAlignVertical="top"
        />

        <View style={{ maxWidth: 200 }}>
          <Eyebrow>Collect radius (m)</Eyebrow>
          <TextInput
            style={s.input}
            accessibilityLabel="Collect radius in metres"
            value={radius}
            onChangeText={setRadius}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>

        <TouchableOpacity
          style={[s.destructRow, selfDestruct && s.destructRowOn]}
          onPress={() => setSelfDestruct((v) => !v)}
          activeOpacity={0.85}
          accessibilityRole="checkbox"
          accessibilityLabel="Burn on delivery. It burns the second they open it."
          accessibilityState={{ checked: selfDestruct }}
        >
          <Ionicons
            name={selfDestruct ? 'flame' : 'flame-outline'}
            size={20}
            color={selfDestruct ? Colors.error : Colors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.destructTitle, selfDestruct && { color: Colors.error }]}>Burn on delivery</Text>
            <Text style={s.destructSub}>It burns the second they open it. One look, then nothing.</Text>
          </View>
          <View style={[s.checkbox, selfDestruct && s.checkboxOn]}>
            {selfDestruct && <Ionicons name="checkmark" size={14} color={Colors.background} />}
          </View>
        </TouchableOpacity>

        {(myCaches ?? []).filter((c) => c.active).length > 0 && (
          <View style={s.chainBlock}>
            <Eyebrow>Chain after (optional)</Eyebrow>
            <Text style={s.chainHint}>They clear that drop first. This one stays shut until then.</Text>
            <View style={s.chipRow}>
              <Chip label="None" selected={!prereqId} onPress={() => setPrereqId(null)} />
              {(myCaches ?? []).filter((c) => c.active).map((c) => (
                <Chip
                  key={c.id}
                  label={c.title || c.share_code || 'Unmarked'}
                  selected={prereqId === c.id}
                  onPress={() => setPrereqId((p) => (p === c.id ? null : c.id))}
                  style={s.chainChip}
                />
              ))}
            </View>
          </View>
        )}

        <Button
          title={busy ? 'Dropping' : 'Drop it here'}
          onPress={onDrop}
          disabled={!ready}
          loading={busy}
          size="lg"
          style={s.send}
          icon={<Ionicons name="flag" size={16} color={Colors.onPrimary} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.sm },
    header: { paddingHorizontal: 0 },
    selfStart: { alignSelf: 'flex-start' },
    preview: { width: '100%', height: 200, borderRadius: Gen.radius, backgroundColor: Colors.surface },
    previewEmpty: {
      width: '100%', height: 200, borderRadius: Gen.radius, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    },
    note: { fontSize: Type.ui.size, color: Colors.textSecondary, fontStyle: 'italic' },
    coordLine: { fontSize: Type.ui.size, lineHeight: Type.ui.lineHeight, color: Colors.textSecondary },
    input: {
      minHeight: Heights.input,
      padding: Spacing.sm, borderRadius: Gen.radius, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border,
      fontSize: Type.body.size, color: Colors.textPrimary,
    },
    rowSplit: { flexDirection: 'row', gap: Spacing.sm },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
    chainChip: { maxWidth: 200 },
    destructRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs,
      padding: Spacing.sm, borderRadius: Gen.radius,
      backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    },
    // The burn accent was a module-level '#FF5A52' that froze at import.
    // Colors.error is the palette's destructive red and follows the skin.
    destructRowOn: { borderColor: Colors.error },
    destructTitle: { fontSize: Type.ui.size, fontWeight: '700', color: Colors.textPrimary },
    destructSub: { fontSize: Type.caption.size, lineHeight: Type.caption.lineHeight, color: Colors.textSecondary, marginTop: 2 },
    checkbox: {
      width: 22, height: 22, borderRadius: Radius.xs,
      borderWidth: 1, borderColor: Colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: Colors.error, borderColor: Colors.error },
    chainBlock: { gap: Spacing.xxs, marginTop: Spacing.sm },
    chainHint: { fontSize: Type.caption.size, color: Colors.textSecondary, fontStyle: 'italic' },
    send: { marginTop: Spacing.xs },
    successCode: {
      fontSize: Type.hero.size, fontWeight: '800', letterSpacing: 4, color: Colors.primary,
      textAlign: 'center', marginVertical: Spacing.xs,
      ...(Platform.OS === 'web' ? ({ fontFamily: 'ui-monospace, monospace' } as any) : {}),
    },
    successLine: {
      fontSize: Type.uiBold.size, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center',
    },
    successHint: {
      fontSize: Type.body.size, lineHeight: Type.body.lineHeight,
      color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xs,
    },
  });
}
