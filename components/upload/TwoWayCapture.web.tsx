/**
 * Two-Way — dual-camera capture (web).
 *
 * One shutter tap → back snap, auto-flip to front, auto-snap, composite.
 * The user does not have to tap twice. Flow:
 *
 *   1. Mount, attach back camera to <video>, wait for first frame.
 *   2. User taps shutter.
 *   3. Capture frame from back stream → cache as backShot.
 *   4. Swap stream to front camera, wait for first frame.
 *   5. Capture frame from front stream → cache as frontShot.
 *   6. Composite: back full-bleed, front rounded inset top-right (mirrored).
 *   7. Hand off via onCapture as a single JPEG.
 *
 * Browsers can't grab two camera streams simultaneously (yet — WebRTC
 * spec issue), so the swap is sequential. End-to-end is ~600–900 ms
 * which is short enough that the subject doesn't move noticeably.
 *
 * Mobile-only: desktop browsers see a stub that points to the phone.
 *
 * The native iOS/Android version (TwoWayCapture.tsx) uses
 * react-native-vision-camera with two simultaneously-active <Camera>
 * components — true at-the-same-instant capture.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { waitForFrame } from './OneWayCapture.web';

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

type Stage = 'requesting' | 'preview' | 'snapping' | 'composing' | 'error';
type Facing = 'environment' | 'user';

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const coarse = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const ua = (navigator.userAgent || '').toLowerCase();
  const uaMobile = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/.test(ua);
  return uaMobile || (coarse && touch);
}

export function TwoWayCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const mobile = typeof window !== 'undefined' ? isMobileBrowser() : false;

  if (!mobile) {
    return (
      <View style={s.notSupported}>
        <Ionicons name="phone-portrait-outline" size={32} color={Colors.textMuted} />
        <Text style={s.notSupportedTitle}>Two-Way is a phone thing</Text>
        <Text style={s.notSupportedText}>
          Open HereToo on your phone (or install the mobile app) to capture
          front + back together.
        </Text>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <TwoWayWebCapture onCapture={onCapture} onClose={onClose} />;
}

function TwoWayWebCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>('requesting');
  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);

  // (Re)acquire camera whenever facing changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Don't drop back into the spinner during the auto-flip step;
      // we want a smooth transition. The orchestrator manages stage.
      try {
        await acquire(facing);
        if (cancelled) return;
      } catch (e: any) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('CAMERA_ACCESS_ERROR', e);
        setError(e?.message ?? 'Could not access camera. Allow permission and try again.');
        setStage('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  useEffect(() => {
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function acquire(f: Facing) {
    // Stop the previous stream first to free the camera hardware
    // (some phones won't let you open a second camera while another
    // is live).
    stopStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: f },
        width: { ideal: 1920 },
        height: { ideal: 1920 },
      },
      audio: false,
    });
    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('Video element not mounted');
    }
    v.srcObject = stream;
    await waitForFrame(v);
    if (stage === 'requesting') setStage('preview');
  }

  /**
   * Single-tap, two-photo orchestration.
   */
  async function snapBoth() {
    const v = videoRef.current;
    if (!v) return;
    setStage('snapping');
    setError(null);
    try {
      // 1. Capture back frame from current stream.
      const backCanvas = drawToCanvas(v, false);
      if (!backCanvas) throw new Error('Canvas unavailable.');

      // 2. Auto-flip to front. Update state so transform / facing flips,
      //    then re-acquire stream and wait for frame.
      setFacing('user');
      // Wait for the new effect to fire and acquire the front camera.
      await waitForFacing(videoRef, 'user');

      // 3. Capture front frame.
      const frontCanvas = drawToCanvas(v, true);
      if (!frontCanvas) throw new Error('Canvas unavailable for front capture.');

      // 4. Composite.
      setStage('composing');
      const blob = await composite(backCanvas, frontCanvas);
      if (!blob) throw new Error('Composite encode failed.');

      const url = URL.createObjectURL(blob);
      stopStream();
      onCapture({
        uri: url,
        width: backCanvas.width,
        height: backCanvas.height,
        type: 'image',
        mimeType: 'image/jpeg',
        fileSize: blob.size,
      });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('TWOWAY_WEB_CAPTURE_ERROR', e);
      setError(e?.message ?? 'Capture failed. Try again.');
      setStage('error');
    }
  }

  return (
    <View style={s.root}>
      {React.createElement('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted: true,
        style: {
          width: '100%', height: '100%', objectFit: 'cover',
          transform: facing === 'user' ? 'scaleX(-1)' : 'none',
          backgroundColor: '#000',
        },
      })}

      {(stage === 'requesting' || stage === 'snapping' || stage === 'composing') && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={s.statusText}>
            {stage === 'requesting' ? 'Asking for camera access…' :
             stage === 'snapping' ? 'Hold still — both cameras…' :
             'Stitching…'}
          </Text>
        </View>
      )}
      {stage === 'error' && (
        <View style={s.overlay}>
          <Ionicons name="alert-circle-outline" size={42} color="#FF6B6B" />
          <Text style={[s.statusText, { color: '#FF6B6B' }]}>{error}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => { setFacing('environment'); setStage('requesting'); setError(null); }}
          >
            <Text style={s.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.hud} pointerEvents="none">
        <Text style={s.hudLabel}>Two-Way · one tap, both cameras</Text>
      </View>

      <View style={s.controls}>
        <TouchableOpacity onPress={() => { stopStream(); onClose(); }} style={s.iconBtn}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>

        {stage === 'preview' ? (
          <TouchableOpacity onPress={snapBoth} style={s.shutter} activeOpacity={0.8}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        ) : (
          <View style={[s.shutter, { opacity: 0.4 }]}><View style={s.shutterInner} /></View>
        )}

        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}

// ── helpers ────────────────────────────────────────────────────────────

/** Snapshot the current <video> frame to a fresh canvas. */
function drawToCanvas(v: HTMLVideoElement, mirror: boolean): HTMLCanvasElement | null {
  const W = v.videoWidth || 1280;
  const H = v.videoHeight || 1280;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0, W, H);
  return c;
}

/**
 * Wait for the next stream change to land on the requested facing.
 * The acquire() effect in TwoWayWebCapture sets srcObject + waits for
 * the first frame; we just poll videoRef.current.readyState until
 * the new stream is live.
 */
async function waitForFacing(
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  _facing: Facing,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  // Wait up to one tick for setFacing to flush + effect to start.
  await new Promise((r) => setTimeout(r, 16));
  while (Date.now() - start < timeoutMs) {
    const v = videoRef.current;
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      // Give it one extra frame to be safe (avoid encoded but
      // not-yet-painted frame).
      await new Promise((r) => setTimeout(r, 80));
      return;
    }
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('Front camera did not start in time.');
}

/** Composite back + front into a single JPEG. */
async function composite(back: HTMLCanvasElement, front: HTMLCanvasElement): Promise<Blob | null> {
  const W = back.width;
  const H = back.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  // Back full-bleed.
  ctx.drawImage(back, 0, 0, W, H);

  // Front inset top-right, ~28% of width, rounded, with black border.
  const insetW = Math.round(W * 0.28);
  const insetH = Math.round(insetW * (front.height / Math.max(1, front.width)));
  const margin = Math.round(W * 0.025);
  const x = W - insetW - margin;
  const y = margin;
  const r = Math.round(insetW * 0.06);

  // Outer black border behind the inset for separation.
  ctx.save();
  roundedRectPath(ctx, x - 4, y - 4, insetW + 8, insetH + 8, r + 4);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // Clipped front draw.
  ctx.save();
  roundedRectPath(ctx, x, y, insetW, insetH, r);
  ctx.clip();
  ctx.drawImage(front, x, y, insetW, insetH);
  ctx.restore();

  return new Promise((resolve) => {
    out.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
  });
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
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusText: { color: '#FFF', fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 },
  hud: { position: 'absolute', top: 30, left: 0, right: 0, alignItems: 'center' },
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
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutter: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },
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
