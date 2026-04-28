/**
 * One-Way — single-camera live capture (web).
 *
 * Live viewfinder with a flip-camera toggle. Tap shutter, get a JPEG
 * back as an ImagePicker-shaped asset so the existing useUpload pipeline
 * handles it like any other photo.
 *
 * Why have this when "Add Photo" exists? Speed and intent: One-Way is
 * an in-the-moment capture that never leaves the app. Add Photo opens
 * the OS library / picker, which is two extra taps and breaks flow.
 *
 * Mobile browsers run the live camera. Desktop browsers can run it too
 * (most laptops have a webcam) but `facingMode: 'environment'` falls
 * back to the only camera available, which is fine.
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

type Stage = 'idle' | 'requesting' | 'preview' | 'capturing' | 'done' | 'error';
type Facing = 'environment' | 'user';

export function OneWayCapture({ onCapture, onClose }: Props) {
  const s = makeStyles();
  const videoRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera(f: Facing) {
    setStage('requesting');
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: f },
          width: { ideal: 1920 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStage('preview');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('CAMERA_ACCESS_ERROR', e);
      setError(e?.message ?? 'Could not access camera. Allow permission and try again.');
      setStage('error');
    }
  }

  async function snap() {
    if (!videoRef.current) return;
    setStage('capturing');
    const W = videoRef.current.videoWidth || 1280;
    const H = videoRef.current.videoHeight || 1280;

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) {
      setError('Canvas unavailable.');
      setStage('error');
      return;
    }

    if (facing === 'user') {
      // Mirror the selfie horizontally so the captured image matches
      // what the user saw in the viewfinder.
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, W, H);

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
      0.92,
    );
  }

  return (
    <View style={s.root}>
      <View style={s.preview}>
        {stage === 'preview' &&
          React.createElement('video', {
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            style: {
              width: '100%', height: '100%', objectFit: 'cover',
              transform: facing === 'user' ? 'scaleX(-1)' : 'none',
            },
          })}
        {(stage === 'requesting' || stage === 'capturing') && (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={s.statusText}>
              {stage === 'requesting' ? 'Asking for camera access…' : 'Snap…'}
            </Text>
          </View>
        )}
        {stage === 'error' && (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={42} color="#FF6B6B" />
            <Text style={[s.statusText, { color: '#FF6B6B' }]}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => startCamera(facing)}>
              <Text style={s.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={s.hud}>
        <Text style={s.hudLabel}>
          {facing === 'environment' ? 'Back camera' : 'Selfie'}
        </Text>
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

function makeStyles() { return StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 1000 },
  preview: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
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
}); }
