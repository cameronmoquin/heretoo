/**
 * One-Way — single-camera live capture (iOS / Android).
 *
 * Live viewfinder via react-native-vision-camera, with a flip toggle
 * for back ↔ front. Tap shutter, get a JPEG back as an asset that the
 * existing useUpload pipeline treats like any other photo.
 *
 * The web build of this file (OneWayCapture.web.tsx) handles browsers;
 * Metro picks the right one per platform.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type PhotoFile,
} from 'react-native-vision-camera';
import { Colors } from '../../constants/colors';

export interface CapturedAsset {
  uri: string;
  width: number;
  height: number;
  type: 'image';
  mimeType: 'image/jpeg';
  fileSize?: number;
}

interface Props {
  onCapture: (asset: CapturedAsset) => void;
  onClose: () => void;
}

export function OneWayCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(facing);
  const { hasPermission, requestPermission } = useCameraPermission();
  const ref = useRef<Camera>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={s.gate}>
        <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
        <Text style={s.gateTitle}>Camera access needed</Text>
        <Text style={s.gateText}>Allow camera permission to capture.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Allow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { marginTop: 6 }]} onPress={onClose}>
          <Text style={s.btnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={s.gate}>
        <ActivityIndicator color="#FFF" />
        <Text style={s.gateText}>Loading camera…</Text>
      </View>
    );
  }

  async function snap() {
    if (busy || !ref.current) return;
    setBusy(true);
    setError(null);
    try {
      const photo: PhotoFile = await ref.current.takePhoto({ flash: 'off' });
      onCapture({
        uri: photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
        width: photo.width,
        height: photo.height,
        type: 'image',
        mimeType: 'image/jpeg',
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('ONEWAY_CAPTURE_ERROR', e);
      setError(e?.message ?? 'Capture failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <Camera
        ref={ref}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
      />

      <View style={s.hud}>
        <Text style={s.hudLabel}>
          {facing === 'back' ? 'Back camera' : 'Selfie'}
        </Text>
      </View>

      {!!error && (
        <View style={s.errPill}><Text style={s.errText}>{error}</Text></View>
      )}

      <View style={s.controls}>
        <TouchableOpacity onPress={onClose} style={s.iconBtn}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={snap}
          style={[s.shutter, busy && { opacity: 0.5 }]}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? <ActivityIndicator color="#000" /> : <View style={s.shutterInner} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          style={s.iconBtn}
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000 },
  hud: { position: 'absolute', top: 30, left: 0, right: 0, alignItems: 'center' },
  hudLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
  },
  errPill: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    backgroundColor: 'rgba(220,40,40,0.9)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  errText: { color: '#FFF', fontSize: 13 },
  controls: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },

  gate: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', padding: 32, gap: 10,
  },
  gateTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 8 },
  gateText: { color: '#999', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
  btn: {
    marginTop: 12, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: '#FFF',
  },
  btnText: { color: '#000', fontWeight: '600' },
}); }
