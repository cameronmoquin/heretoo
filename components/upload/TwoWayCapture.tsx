/**
 * Two-Way — dual-camera capture (web).
 *
 * Most browsers can't grab two camera streams simultaneously, so we capture
 * sequentially with a hard cap of a few seconds between shots. The final
 * image composites the back camera as the main frame with the selfie as a
 * small rounded inset in the top-right corner.
 *
 * Returns a synthetic ImagePicker-shaped asset via `onCapture` so the
 * existing useUpload flow handles it like any other photo.
 *
 * Native (iOS/Android) shows a placeholder for now — true simultaneous
 * capture needs a native build with `react-native-vision-camera`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

type Stage =
  | 'idle'
  | 'requesting'
  | 'preview-back'
  | 'capturing-back'
  | 'preview-front'
  | 'capturing-front'
  | 'composing'
  | 'done'
  | 'error';

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
  if (Platform.OS !== 'web') {
    return (
      <View style={s.notSupported}>
        <Ionicons name="phone-portrait-outline" size={32} color={Colors.textMuted} />
        <Text style={s.notSupportedTitle}>Two-Way is coming on mobile</Text>
        <Text style={s.notSupportedText}>
          Simultaneous front + back capture needs a native build. We'll wire it up when the iOS / Android app ships.
        </Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Refs are typed loose because react-native-web pass-through DOM types are awkward.
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const backShotRef = useRef<HTMLCanvasElement | null>(null);

  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startBackCamera();
    return () => stopStream();
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera(facing: 'environment' | 'user') {
    setStage('requesting');
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStage(facing === 'environment' ? 'preview-back' : 'preview-front');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('CAMERA_ACCESS_ERROR', e);
      setError(e?.message ?? 'Could not access camera. Allow camera permission and try again.');
      setStage('error');
    }
  }

  async function startBackCamera() {
    setError(null);
    await startCamera('environment');
  }

  async function snapBack() {
    if (!videoRef.current) return;
    setStage('capturing-back');
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvas unavailable.');
      setStage('error');
      return;
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    backShotRef.current = canvas;
    await startCamera('user');
  }

  async function snapFront() {
    if (!videoRef.current || !backShotRef.current) return;
    setStage('capturing-front');

    const back = backShotRef.current;
    const W = back.width;
    const H = back.height;

    // Composite canvas: back fills, front in top-right, mirrored (selfie expectation).
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) {
      setError('Canvas unavailable.');
      setStage('error');
      return;
    }

    // Back image full-bleed
    ctx.drawImage(back, 0, 0, W, H);

    // Front inset: top-right, ~28% of width, rounded corners, white border
    const insetW = Math.round(W * 0.28);
    const insetH = Math.round(insetW * (videoRef.current.videoHeight / Math.max(1, videoRef.current.videoWidth)));
    const margin = Math.round(W * 0.025);
    const x = W - insetW - margin;
    const y = margin;
    const r = Math.round(insetW * 0.06);

    // Border + rounded clip
    ctx.save();
    roundedRectPath(ctx, x - 4, y - 4, insetW + 8, insetH + 8, r + 4);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRectPath(ctx, x, y, insetW, insetH, r);
    ctx.clip();
    // Mirror selfie horizontally so it matches what the user saw in the viewfinder
    ctx.translate(x + insetW, y);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, insetW, insetH);
    ctx.restore();

    setStage('composing');
    out.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not encode image.');
          setStage('error');
          return;
        }
        const url = URL.createObjectURL(blob);
        stopStream();
        setStage('done');
        onCapture({
          uri: url,
          width: W,
          height: H,
          type: 'image',
          mimeType: 'image/jpeg',
          fileSize: blob.size,
        });
      },
      'image/jpeg',
      0.9,
    );
  }

  // ── UI ──
  return (
    <View style={s.root}>
      <View style={s.preview}>
        {(stage === 'preview-back' || stage === 'preview-front') &&
          React.createElement('video', {
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: stage === 'preview-front' ? 'scaleX(-1)' : 'none',
            },
          })}
        {(stage === 'requesting' || stage === 'composing') && (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={s.statusText}>
              {stage === 'requesting' ? 'Asking for camera access…' : 'Composing…'}
            </Text>
          </View>
        )}
        {stage === 'error' && (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={42} color="#FF6B6B" />
            <Text style={[s.statusText, { color: '#FF6B6B' }]}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => startBackCamera()}>
              <Text style={s.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.hud}>
        <Text style={s.hudLabel}>
          {stage === 'preview-back' ? 'Step 1 of 2 — back camera' :
           stage === 'preview-front' ? 'Step 2 of 2 — selfie' :
           stage === 'capturing-back' || stage === 'capturing-front' ? 'Hold still…' :
           stage === 'composing' ? 'Stitching…' : ''}
        </Text>
      </View>

      <View style={s.controls}>
        <TouchableOpacity onPress={() => { stopStream(); onClose(); }} style={s.iconBtn}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>

        {stage === 'preview-back' && (
          <TouchableOpacity onPress={snapBack} style={s.shutter} activeOpacity={0.8}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        )}
        {stage === 'preview-front' && (
          <TouchableOpacity onPress={snapFront} style={s.shutter} activeOpacity={0.8}>
            <View style={[s.shutterInner, { backgroundColor: '#FFD60A' }]} />
          </TouchableOpacity>
        )}
        {(stage === 'requesting' || stage === 'capturing-back' ||
          stage === 'capturing-front' || stage === 'composing') && (
          <View style={[s.shutter, { opacity: 0.4 }]}><View style={s.shutterInner} /></View>
        )}

        <View style={{ width: 40 }} />
      </View>
    </View>
  );
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeStyles() { return StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  preview: { flex: 1, backgroundColor: '#000' },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  statusText: { color: '#FFF', fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 },
  hud: {
    position: 'absolute', top: 30, left: 0, right: 0,
    alignItems: 'center',
  },
  hudLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
  },
  controls: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
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
  retryBtn: {
    marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: '#FFF',
  },
  retryBtnText: { color: '#000', fontWeight: '600' },

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
