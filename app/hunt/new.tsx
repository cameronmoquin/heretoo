/**
 * /hunt/new — hide a cache.
 *
 * Take a photo, grab your GPS, drop the pin, write a title and hint, and
 * publish. You get a share code + seeker link to send. Web-first: the
 * photo uses the device camera via a file input; GPS uses the browser
 * Geolocation API.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateHuntCache, useUploadHuntPhoto,
} from '../../hooks/useHunt';
import { useGeolocation } from '../../hooks/useGeolocation';
import { HuntMap } from '../../components/hunt/HuntMap';
import { showAlert } from '../../lib/alert';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

function genId(): string {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}
function huntUrl(code: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://heretoo.social';
  return `${origin}/hunt/${code}`;
}

export default function HuntNew() {
  const s = makeStyles();
  const { coords, error: geoError } = useGeolocation();
  const create = useCreateHuntCache();
  const upload = useUploadHuntPhoto();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [radius, setRadius] = useState('25');
  const [scope, setScope] = useState<'link' | 'public'>('link');
  const [result, setResult] = useState<{ code: string } | null>(null);

  const busy = create.isPending || upload.isPending;
  const ready = !!coords && !!file && !busy;

  const onPickFile = (evt: any) => {
    const f: File | undefined = evt?.target?.files?.[0];
    if (!f) return;
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onDrop = async () => {
    if (!coords || !file) return;
    try {
      const id = genId();
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const photoPath = await upload.mutateAsync({ cacheId: id, file, kind: 'clue', ext });
      const cache = await create.mutateAsync({
        id,
        title, hint,
        lat: coords.lat, lng: coords.lng, accuracyM: coords.accuracy,
        radiusM: Math.max(5, parseInt(radius, 10) || 25),
        photoPath, scope,
      });
      setResult({ code: cache.share_code || '' });
    } catch (e: any) {
      showAlert('Could not drop the cache', e?.message ?? 'Try again.');
    }
  };

  const copyLink = async () => {
    if (!result?.code) return;
    const url = huntUrl(result.code);
    try {
      await (navigator as any).clipboard?.writeText(url);
      showAlert('Link copied', url);
    } catch { showAlert('Seeker link', url); }
  };

  const center = useMemo(
    () => coords ?? { lat: 39.8283, lng: -98.5795 }, // US centroid until a fix lands
    [coords?.lat, coords?.lng],
  );

  // ── Success state ───────────────────────────────────────────────────
  if (result) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.kicker}>Cache dropped</Text>
          <Text style={s.successCode}>{result.code}</Text>
          <Text style={s.successHint}>
            Send this code or the link. The seeker enters it and follows the
            compass to your spot.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace(`/hunt/${result.code}`)} activeOpacity={0.85}>
            <Ionicons name="navigate" size={16} color="#FFF" />
            <Text style={s.primaryBtnText}>Find it now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.outlineBtn} onPress={copyLink} activeOpacity={0.85}>
            <Ionicons name="link" size={16} color={Colors.primary} />
            <Text style={s.outlineBtnText}>Copy seeker link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ghostBtn} onPress={() => router.replace('/hunt')} activeOpacity={0.85}>
            <Text style={s.ghostBtnText}>Back to hunts</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.kicker}>Hide a cache</Text>
        </View>

        {/* Photo */}
        <Text style={s.label}>The photo</Text>
        {previewUrl ? (
          <RNImage source={{ uri: previewUrl }} style={s.preview} resizeMode="cover" />
        ) : (
          <View style={s.previewEmpty}><Ionicons name="camera-outline" size={28} color={Colors.textMuted} /></View>
        )}
        {Platform.OS === 'web' ? (
          <label style={({
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            padding: '10px 16px', background: Colors.surface, color: Colors.textPrimary,
            border: `1px solid ${Colors.border}`, borderRadius: 999, cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
          } as any)}>
            {file ? 'Retake / choose another' : 'Take or choose a photo'}
            <input type="file" accept="image/*" capture="environment" onChange={onPickFile} style={({ display: 'none' } as any)} />
          </label>
        ) : (
          <Text style={s.note}>Hiding a cache works from the web app for now.</Text>
        )}

        {/* Location */}
        <Text style={s.label}>Where you are</Text>
        <HuntMap center={center} pin={coords ?? null} height={220} />
        <Text style={s.coordLine}>
          {coords
            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} · ±${Math.round(coords.accuracy)}m`
            : geoError === 'denied'
              ? 'Location permission blocked. Enable it to drop a cache.'
              : geoError === 'unsupported'
                ? 'Location is not available on this device.'
                : 'Getting your location…'}
        </Text>

        {/* Details */}
        <Text style={s.label}>Title</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="The old oak by the pond" placeholderTextColor={Colors.textMuted} maxLength={80} />
        <Text style={s.label}>Hint (optional)</Text>
        <TextInput style={[s.input, { minHeight: 70 }]} value={hint} onChangeText={setHint} placeholder="Look low, near the roots." placeholderTextColor={Colors.textMuted} multiline maxLength={200} textAlignVertical="top" />

        <View style={s.rowSplit}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Find radius (m)</Text>
            <TextInput style={s.input} value={radius} onChangeText={setRadius} keyboardType="number-pad" maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Visibility</Text>
            <View style={s.segment}>
              {(['link', 'public'] as const).map((v) => (
                <TouchableOpacity key={v} style={[s.segBtn, scope === v && s.segBtnOn]} onPress={() => setScope(v)} activeOpacity={0.85}>
                  <Text style={[s.segText, scope === v && s.segTextOn]}>{v === 'link' ? 'Link only' : 'Public'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={[s.primaryBtn, !ready && { opacity: 0.5 }]} onPress={onDrop} disabled={!ready} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Ionicons name="flag" size={16} color="#FFF" />}
          <Text style={s.primaryBtnText}>{busy ? 'Dropping…' : 'Drop the cache here'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'transparent', maxWidth: 720, alignSelf: 'center', width: '100%' },
    scroll: { padding: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kicker: {
      fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase',
      ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
    },
    label: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 },
    preview: { width: '100%', height: 200, borderRadius: Radius.lg, backgroundColor: Colors.surface },
    previewEmpty: {
      width: '100%', height: 200, borderRadius: Radius.lg, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    },
    note: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
    coordLine: { fontSize: 13, color: Colors.textSecondary },
    input: {
      padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.surface,
      borderWidth: 1, borderColor: Colors.border, fontSize: 16, color: Colors.textPrimary,
    },
    rowSplit: { flexDirection: 'row', gap: 12 },
    segment: { flexDirection: 'row', gap: 6 },
    segBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
    segBtnOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
    segText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
    segTextOn: { color: Colors.primary },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 14, borderRadius: Radius.full, backgroundColor: Colors.primary, marginTop: 10,
    },
    primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    outlineBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, borderRadius: Radius.full,
      borderWidth: 1, borderColor: Colors.primary, marginTop: 8,
    },
    outlineBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
    ghostBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
    ghostBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
    successCode: {
      fontSize: 40, fontWeight: '800', letterSpacing: 4, color: Colors.primary, textAlign: 'center', marginVertical: 8,
      ...(Platform.OS === 'web' ? ({ fontFamily: 'ui-monospace, monospace' } as any) : {}),
    },
    successHint: { fontSize: 15, lineHeight: 23, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  });
}
