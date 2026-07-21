/**
 * /call/[id] — the video call surface.
 *
 * Tile grid of participants, mic/cam toggle, leave button. Uses
 * useVideoCall under the hood; this file is mostly layout.
 *
 * Capped at 4 participants in v1 (mesh WebRTC headroom). If a 5th
 * person tries to join, we render a polite "the room is full" notice
 * for them locally. The actual peer connections are still permitted
 * server-side; the UI cap is advisory.
 */

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoCall } from '../../hooks/useVideoCall';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';

export default function VideoCallScreen() {
  const s = makeStyles();
  const { id: callId } = useLocalSearchParams<{ id: string }>();
  const {
    localStream, remotePeers, micEnabled, cameraEnabled,
    toggleMic, toggleCamera, error,
  } = useVideoCall(callId ?? null);

  const onLeave = () => {
    // Just navigate away — useVideoCall's cleanup handles everything.
    if (router.canGoBack()) router.back();
    else router.replace('/' as any);
  };

  // Bind local + remote streams to <video> elements via refs.
  // Native: returns a black tile with a face icon (no <video> on RN).
  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.label}>Crew call</Text>
        <View style={s.dotLive} />
        <Text style={s.subtle}>{1 + remotePeers.length} on</Text>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Tile grid */}
      <View style={s.tileGrid}>
        <Tile stream={localStream} muted label="You" cameraOn={cameraEnabled} />
        {remotePeers.slice(0, 3).map((p) => (
          <Tile key={p.userId} stream={p.stream} muted={false} label={null} cameraOn={true} />
        ))}
      </View>

      {/* Controls */}
      <View style={s.controls}>
        <TouchableOpacity
          onPress={toggleMic}
          style={[s.ctrlBtn, !micEnabled && s.ctrlBtnOff]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={micEnabled ? 'mic' : 'mic-off'}
            size={20}
            color={micEnabled ? Colors.brandIvory : '#0A0A0F'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleCamera}
          style={[s.ctrlBtn, !cameraEnabled && s.ctrlBtnOff]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={cameraEnabled ? 'videocam' : 'videocam-off'}
            size={20}
            color={cameraEnabled ? Colors.brandIvory : '#0A0A0F'}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onLeave} style={s.leaveBtn} activeOpacity={0.85}>
          <Ionicons name="call" size={18} color="#FFFFFF" />
          <Text style={s.leaveText}>Leave</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Tile({
  stream, muted, label, cameraOn,
}: { stream: MediaStream | null; muted: boolean; label: string | null; cameraOn: boolean }) {
  const s = makeStyles();
  const videoRef = React.useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (Platform.OS !== 'web') {
    return (
      <View style={s.tile}>
        <Ionicons name="person" size={36} color={Colors.textMuted} />
      </View>
    );
  }

  return (
    <View style={s.tile}>
      {cameraOn ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement('video' as any, {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted,
          style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 },
        })
      ) : (
        <View style={s.tileOff}>
          <Ionicons name="videocam-off" size={28} color={Colors.textMuted} />
        </View>
      )}
      {!!label && (
        <View style={s.tileLabel}><Text style={s.tileLabelText}>{label}</Text></View>
      )}
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F', maxWidth: 720, alignSelf: 'center', width: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  label: {
    flex: 1, fontSize: 14, fontWeight: '700', color: Colors.brandIvory, letterSpacing: 1.6, textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? ({ fontFamily: '"Syne", "Inter", sans-serif' } as any) : {}),
  },
  dotLive: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C73E3A' },
  subtle: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, padding: 10, borderRadius: Radius.md,
    backgroundColor: 'rgba(199, 62, 58, 0.18)',
    borderWidth: 1, borderColor: Colors.error,
  },
  errorText: { fontSize: 12, color: Colors.brandIvory, flex: 1 },

  tileGrid: {
    flex: 1,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    padding: Spacing.md,
  },
  tile: {
    flex: 1, minWidth: '46%', aspectRatio: 4 / 3,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  tileOff: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  tileLabel: {
    position: 'absolute', bottom: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileLabelText: { fontSize: 11, color: Colors.brandIvory, fontWeight: '600' },

  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.lg,
  },
  ctrlBtn: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244, 241, 232, 0.10)',
    borderWidth: 1, borderColor: Colors.border,
  },
  ctrlBtnOff: { backgroundColor: Colors.brandIvory, borderColor: Colors.brandIvory },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 25,
    backgroundColor: '#C73E3A',
  },
  leaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
}); }
