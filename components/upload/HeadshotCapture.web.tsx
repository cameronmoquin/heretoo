/**
 * HeadshotCapture — square headshot via the front camera (web).
 *
 * Always-front-facing live capture with a circular viewfinder overlay
 * so the user knows where their face has to land. The shutter produces
 * a 512×512 square JPEG so every avatar is consistent regardless of
 * source device.
 *
 * On mobile web this works through `getUserMedia({ facingMode: 'user' })`.
 * On desktop it falls back to whatever single camera is available
 * (laptop webcam) which is also fine for an avatar.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export interface HeadshotResult {
  uri: string;
  width: number;
  height: number;
  type: 'image';
  mimeType: 'image/jpeg';
  fileSize?: number;
}

interface Props {
  onCapture: (asset: HeadshotResult) => void;
  onClose: () => void;
}

const OUTPUT_SIZE = 512;

type Stage = 'requesting' | 'preview' | 'capturing' | 'error';

export function HeadshotCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>('requesting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
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
          await waitForFrame(v);
          if (!cancelled) setStage('preview');
        }
      } catch (e: any) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('HEADSHOT_CAMERA_ERROR', e);
          setError(e?.message ?? 'Could not access camera. Allow permission and try again.');
          setStage('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    setStage('capturing');

    // Center-square crop from the source frame, then downscale to OUTPUT_SIZE.
    const W = v.videoWidth || 1280;
    const H = v.videoHeight || 1280;
    const side = Math.min(W, H);
    const sx = Math.round((W - side) / 2);
    const sy = Math.round((H - side) / 2);

    const out = document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) {
      setError('Canvas unavailable.');
      setStage('error');
      return;
    }

    // Mirror the selfie horizontally so the captured image matches the
    // viewfinder. Browser previews <video> with a CSS mirror; the canvas
    // doesn't get that for free.
    ctx.translate(OUTPUT_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    out.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not encode headshot.');
          setStage('error');
          return;
        }
        const url = URL.createObjectURL(blob);
        stopStream();
        onCapture({
          uri: url,
          width: OUTPUT_SIZE,
          height: OUTPUT_SIZE,
          type: 'image',
          mimeType: 'image/jpeg',
          fileSize: blob.size,
        });
      },
      'image/jpeg',
      0.92,
    );
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
          transform: 'scaleX(-1)',
          backgroundColor: '#000',
        },
      })}

      {/* Circular viewfinder overlay — pointer-events-none so taps fall through. */}
      <View pointerEvents="none" style={s.overlay}>
        <View style={s.viewfinderCircle} />
        <Text style={s.hudLabel}>Center your face in the circle</Text>
      </View>

      {(stage === 'requesting' || stage === 'capturing') && (
        <View style={s.spinnerOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={s.statusText}>
            {stage === 'requesting' ? 'Asking for camera access…' : 'Snap…'}
          </Text>
        </View>
      )}

      {stage === 'error' && (
        <View style={s.spinnerOverlay}>
          <Ionicons name="alert-circle-outline" size={42} color="#FF6B6B" />
          <Text style={[s.statusText, { color: '#FF6B6B' }]}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onClose}>
            <Text style={s.retryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

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
        <View style={{ width: 44 }} />
      </View>
    </View>
  );
}

function waitForFrame(v: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (v.readyState >= 2 && v.videoWidth > 0) { resolve(); return; }
    const t = setTimeout(() => { cleanup(); reject(new Error('Camera frame timeout')); }, timeoutMs);
    const onReady = () => {
      if (v.readyState >= 2 && v.videoWidth > 0) { cleanup(); resolve(); }
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
    v.play().catch(() => {});
  });
}

function makeStyles() { return StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 18,
  },
  viewfinderCircle: {
    width: 280, height: 280, borderRadius: 140,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 18,
  },
  hudLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5,
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusText: { color: '#FFF', fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 },
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
}); }
