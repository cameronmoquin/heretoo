/**
 * One-Way — single-camera live capture (web).
 *
 * Live viewfinder with a flip-camera toggle. Tap shutter, get a JPEG.
 *
 * Why "always-mount" the <video>: React Native Web only passes `ref` to
 * a real DOM node when the element is mounted. Conditionally rendering
 * `<video>` based on stage made `videoRef.current` null at the moment
 * we tried to attach `srcObject`, leaving the camera disconnected and
 * the canvas drawing pure black. The fix is to keep <video> in the DOM
 * the whole time and toggle overlays on top of it.
 *
 * Why we wait for `readyState >= HAVE_CURRENT_DATA` before capture:
 * `getUserMedia()` resolves before the first frame paints. Drawing to
 * canvas immediately gives you the empty 0x0 backbuffer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type Stage = 'requesting' | 'preview' | 'capturing' | 'error';
type Facing = 'environment' | 'user';

export function OneWayCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [stage, setStage] = useState<Stage>('requesting');
  const [error, setError] = useState<string | null>(null);

  // (Re)acquire camera whenever facing changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStage('requesting');
      setError(null);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          // Wait for first frame before letting the user shoot.
          await waitForFrame(v);
          if (!cancelled) setStage('preview');
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('CAMERA_ACCESS_ERROR', e);
        if (!cancelled) {
          setError(e?.message ?? 'Could not access camera. Allow permission and try again.');
          setStage('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // Cleanup on unmount.
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

  async function snap() {
    const v = videoRef.current;
    if (!v) return;
    setStage('capturing');
    const blob = await captureFrame(v, facing);
    if (!blob) {
      setError('Could not encode image.');
      setStage('error');
      return;
    }
    const url = URL.createObjectURL(blob);
    stopStream();
    onCapture({
      uri: url,
      width: v.videoWidth,
      height: v.videoHeight,
      type: 'image',
      mimeType: 'image/jpeg',
      fileSize: blob.size,
    });
  }

  return (
    <View style={s.root}>
      {/*
        Always-mounted <video>. Hidden visually behind overlays during
        non-preview stages but kept in the DOM so videoRef stays valid.
      */}
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

      {(stage === 'requesting' || stage === 'capturing') && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={s.statusText}>
            {stage === 'requesting' ? 'Asking for camera access…' : 'Snap…'}
          </Text>
        </View>
      )}
      {stage === 'error' && (
        <View style={s.overlay}>
          <Ionicons name="alert-circle-outline" size={42} color="#FF6B6B" />
          <Text style={[s.statusText, { color: '#FF6B6B' }]}>{error}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => {
              // Trigger effect re-run by toggling facing back to itself.
              setFacing((f) => f);
              setStage('requesting');
              setError(null);
            }}
          >
            <Text style={s.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.hud} pointerEvents="none">
        <Text style={s.hudLabel}>{facing === 'environment' ? 'Back camera' : 'Selfie'}</Text>
      </View>

      <View style={s.controls}>
        <TouchableOpacity onPress={() => { stopStream(); onClose(); }} style={s.iconBtn}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>

        {stage === 'preview' ? (
          <TouchableOpacity onPress={snap} style={s.shutter} activeOpacity={0.8}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        ) : (
          <View style={[s.shutter, { opacity: 0.4 }]}><View style={s.shutterInner} /></View>
        )}

        <TouchableOpacity
          onPress={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          style={s.iconBtn}
          disabled={stage !== 'preview'}
        >
          <Ionicons name="camera-reverse-outline" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Wait until the <video> has a real frame to draw. `getUserMedia`
 * resolves before the first frame, and `play()` resolves when playback
 * starts but not necessarily after a frame is decoded — so we listen
 * for `loadeddata` and double-check `readyState >= HAVE_CURRENT_DATA`.
 */
export function waitForFrame(v: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (v.readyState >= 2 && v.videoWidth > 0) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      cleanup();
      reject(new Error('Camera frame timeout'));
    }, timeoutMs);
    const onReady = () => {
      if (v.readyState >= 2 && v.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(t);
      v.removeEventListener('loadeddata', onReady);
      v.removeEventListener('canplay', onReady);
      v.removeEventListener('playing', onReady);
    };
    v.addEventListener('loadeddata', onReady);
    v.addEventListener('canplay', onReady);
    v.addEventListener('playing', onReady);
    // Try playing in case it's paused.
    v.play().catch(() => {});
  });
}

/**
 * Draw the current video frame to a canvas, mirroring the selfie if
 * needed, and encode as a JPEG blob.
 */
export function captureFrame(v: HTMLVideoElement, facing: Facing): Promise<Blob | null> {
  const W = v.videoWidth || 1280;
  const H = v.videoHeight || 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  if (facing === 'user') {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, 0, 0, W, H);
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
  });
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
    width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)',
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
}); }
