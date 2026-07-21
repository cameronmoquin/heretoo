/**
 * Two-Way — simultaneous front + back capture (mobile only).
 *
 * Uses react-native-vision-camera with two <Camera> components active at
 * once. On iOS this triggers AVCaptureMultiCamSession (iPhone XS or later);
 * on Android it uses Camera2 logical multi-camera. The shutter calls
 * takePhoto() on both cameras in the same tick — the kernel sequences them
 * within ~30 ms, which is functionally simultaneous for the human subject.
 *
 * The two photo URIs are composited via expo-image-manipulator: back as
 * the main frame, front as a rounded inset in the top-right.
 *
 * Web is unsupported on purpose — the dual-camera UX only feels right on
 * a phone, and most browsers can't grab two streams simultaneously
 * anyway. Web users get a "use the mobile app" message.
 *
 * REQUIREMENTS
 *   - This component will NOT run in Expo Go (Vision Camera is a native
 *     module). It needs an EAS dev build / standalone build.
 *   - On devices without multi-cam hardware, both cameras still work
 *     individually but capture races may be slightly off — Vision Camera
 *     handles the fallback transparently.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
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

export function TwoWayCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();

  // ── Web stub: Two-Way is mobile-only ──
  if (Platform.OS === 'web') {
    return (
      <View style={s.notSupported}>
        <Ionicons name="phone-portrait-outline" size={32} color={Colors.textMuted} />
        <Text style={s.notSupportedTitle}>Two-Way is mobile only</Text>
        <Text style={s.notSupportedText}>
          Open HereToo on your phone.
        </Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <TwoWayNative onCapture={onCapture} onClose={onClose} />;
}

// ────────────────────────────────────────────────────────────────────────
// Native implementation (iOS / Android)
// ────────────────────────────────────────────────────────────────────────
function TwoWayNative({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const back = useCameraDevice('back');
  const front = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const backRef = useRef<Camera>(null);
  const frontRef = useRef<Camera>(null);
  const compositeRef = useRef<View>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<{ back: string; front: string; w: number; h: number } | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={s.notSupported}>
        <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
        <Text style={s.notSupportedTitle}>Camera access needed</Text>
        <Text style={s.notSupportedText}>
          Allow camera permission to use Two-Way.
        </Text>
        <TouchableOpacity style={s.closeBtn} onPress={requestPermission}>
          <Text style={s.closeBtnText}>Allow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.closeBtn, { marginTop: 6 }]} onPress={onClose}>
          <Text style={s.closeBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!back || !front) {
    return (
      <View style={s.notSupported}>
        <ActivityIndicator color="#FFF" />
        <Text style={s.notSupportedText}>Loading cameras…</Text>
      </View>
    );
  }

  async function snap() {
    if (busy || !backRef.current || !frontRef.current) return;
    setBusy(true);
    setError(null);

    try {
      // Fire both takePhoto calls in the same microtask. Vision Camera
      // returns promises; awaiting the pair together gets us within
      // ~30 ms on multi-cam-capable devices, which is functionally
      // simultaneous for human subjects.
      const [backShot, frontShot] = await Promise.all<PhotoFile>([
        backRef.current.takePhoto({ flash: 'off' }),
        frontRef.current.takePhoto({ flash: 'off' }),
      ]);

      // Stage the offscreen composite View, then captureRef it.
      setShots({
        back: uriOf(backShot),
        front: uriOf(frontShot),
        w: backShot.width,
        h: backShot.height,
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('TWOWAY_CAPTURE_ERROR', e);
      setError(e?.message ?? 'Capture failed. Try again.');
      setBusy(false);
    }
  }

  // Once the composite View is mounted with both shots, capture it.
  useEffect(() => {
    if (!shots) return;
    let cancelled = false;
    (async () => {
      try {
        // Give the view one frame to lay out before capture.
        await new Promise((r) => setTimeout(r, 50));
        const uri = await captureRef(compositeRef, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
        });
        if (cancelled) return;
        onCapture({
          uri,
          width: shots.w,
          height: shots.h,
          type: 'image',
          mimeType: 'image/jpeg',
        });
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('TWOWAY_COMPOSITE_ERROR', e);
        if (!cancelled) setError(e?.message ?? 'Compose failed. Try again.');
      } finally {
        if (!cancelled) {
          setShots(null);
          setBusy(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [shots, onCapture]);

  return (
    <View style={s.root}>
      {/* Back camera fills the frame */}
      <Camera
        ref={backRef}
        style={StyleSheet.absoluteFill}
        device={back}
        isActive
        photo
      />

      {/* Front camera as a rounded picture-in-picture */}
      <View style={s.pip} pointerEvents="none">
        <Camera
          ref={frontRef}
          style={StyleSheet.absoluteFill}
          device={front}
          isActive
          photo
        />
      </View>

      <View style={s.hud}>
        <Text style={s.hudLabel}>Two-Way</Text>
      </View>

      {!!error && (
        <View style={s.errorPill}>
          <Text style={s.errorText}>{error}</Text>
        </View>
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

        <View style={{ width: 40 }} />
      </View>

      {/*
        Offscreen composite: rendered behind the live preview when shots
        are available, captured by react-native-view-shot, then unmounted.
        Positioned with negative left so it stays out of view but still
        lays out and renders pixels (zero-size or display:none would skip
        layout and break captureRef).
      */}
      {shots && (
        <View
          ref={compositeRef}
          collapsable={false}
          style={[s.composite, { width: shots.w, height: shots.h }]}
        >
          <Image
            source={{ uri: shots.back }}
            style={{ width: shots.w, height: shots.h }}
            resizeMode="cover"
          />
          <View style={[
            s.compositeInset,
            {
              // Bigger inset (32% of width), portrait aspect, white rim,
              // soft shadow — matches the polish of the web composite.
              width: Math.round(shots.w * 0.32),
              height: Math.round(shots.w * 0.32 * 4 / 3),
              top: Math.round(shots.w * 0.03),
              right: Math.round(shots.w * 0.03),
              borderRadius: Math.round(shots.w * 0.026),
              borderWidth: Math.round(shots.w * 0.006),
            },
          ]}>
            <Image
              source={{ uri: shots.front }}
              style={{ width: '100%', height: '100%', transform: [{ scaleX: -1 }] }}
              resizeMode="cover"
            />
          </View>
        </View>
      )}
    </View>
  );
}

function uriOf(p: PhotoFile): string {
  // iOS returns a path without scheme; Android already has file://
  if (p.path.startsWith('file://')) return p.path;
  return `file://${p.path}`;
}

function makeStyles() { return StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  pip: {
    position: 'absolute',
    top: 60, right: 18,
    width: 130, height: 175,
    borderRadius: 18,
    borderWidth: 4, borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#222',
    transform: [{ scaleX: -1 }], // mirror the live front preview
    // Soft shadow so the PIP separates from any background.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  hud: {
    position: 'absolute', top: 30, left: 0, right: 0,
    alignItems: 'center',
  },
  hudLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
  },
  errorPill: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    backgroundColor: 'rgba(220,40,40,0.9)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  errorText: { color: '#FFF', fontSize: 13 },

  controls: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF',
  },

  // Offscreen composite — laid out at native pixel size, rendered out of
  // view but still painted so captureRef can grab it.
  composite: {
    position: 'absolute',
    left: -100000,
    top: 0,
    backgroundColor: '#000',
  },
  compositeInset: {
    position: 'absolute',
    overflow: 'hidden',
    borderColor: '#FFFFFF',
    backgroundColor: '#222',
    // borderWidth set inline so it scales with image dimensions.
    // Native shadow for iOS:
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    // Android elevation:
    elevation: 8,
  },

  notSupported: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', padding: 32, gap: 12,
  },
  notSupportedTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 8 },
  notSupportedText: { color: '#999', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 19 },
  closeBtn: {
    marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: '#FFF',
  },
  closeBtnText: { color: '#000', fontWeight: '600' },
}); }
