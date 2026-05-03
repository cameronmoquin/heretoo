/**
 * Press-and-hold microphone button — records the user's voice via
 * MediaRecorder, ships the audio to /api/stt, and inserts the
 * transcribed text into the parent's text input via the `onText`
 * callback.
 *
 * Drop this next to any text input where typing is awkward (composer,
 * comments, chat). Web-only for now — native gets nothing yet (we'll
 * wire expo-av once the native build ships).
 *
 * Interaction model: tap to start recording, tap again to stop. We
 * picked tap-toggle over press-and-hold because press-and-hold gets
 * accidentally released on touchscreens during a long thought —
 * tap-toggle is more forgiving and matches Voice Memos.
 *
 * Auto-stop at 60s so a forgotten recording doesn't run forever.
 */

import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View, Text, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface Props {
  /** Called with the transcribed text. Append vs replace is up to caller. */
  onText: (text: string) => void;
  /** Optional size override (default 18). */
  size?: number;
  /** Disable the control (e.g., while parent is busy). */
  disabled?: boolean;
}

const MAX_DURATION_MS = 60_000;

export function MicInputButton({ onText, size = 18, disabled }: Props) {
  const [stage, setStage] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimer = useRef<number | null>(null);

  // Native: not yet wired. Render nothing rather than a broken button.
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  // If MediaRecorder isn't available (rare these days, but Safari iOS
  // had spotty support until 14.5), don't render at all.
  if (typeof window.MediaRecorder === 'undefined') return null;

  useEffect(() => {
    return () => {
      // On unmount: stop any in-flight recording cleanly.
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
      if (autoStopTimer.current) window.clearTimeout(autoStopTimer.current);
    };
  }, []);

  const startRecording = async () => {
    setErrMsg(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick the most widely-supported MIME the browser offers.
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' :
        '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        // Release the mic ASAP so the browser's recording indicator
        // disappears the moment the user stops talking.
        stream.getTracks().forEach((t) => t.stop());
        setStage('transcribing');
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        try {
          const res = await fetch('/api/stt', {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error ?? `STT failed (${res.status})`);
          }
          const { text } = await res.json();
          if (text && typeof text === 'string') onText(text.trim());
          setStage('idle');
        } catch (e: any) {
          setErrMsg(e?.message ?? 'Could not transcribe');
          setStage('error');
          // Auto-clear the error after 4s so the button comes back.
          window.setTimeout(() => { setStage('idle'); setErrMsg(null); }, 4000);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setStage('recording');
      // Auto-stop guard so a forgotten recording doesn't run forever.
      autoStopTimer.current = window.setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, MAX_DURATION_MS);
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Mic permission denied');
      setStage('error');
      window.setTimeout(() => { setStage('idle'); setErrMsg(null); }, 4000);
    }
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    if (autoStopTimer.current) {
      window.clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
  };

  const onPress = () => {
    if (stage === 'recording') stopRecording();
    else if (stage === 'idle') void startRecording();
  };

  const tint =
    stage === 'recording' ? Colors.error :
    stage === 'error' ? Colors.error :
    stage === 'transcribing' ? Colors.primary :
    Colors.textSecondary;

  const icon =
    stage === 'recording' ? 'stop-circle' :
    stage === 'error' ? 'alert-circle-outline' :
    'mic-outline';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || stage === 'transcribing'}
      style={s.btn}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityLabel={
        stage === 'recording' ? 'Stop recording' :
        stage === 'transcribing' ? 'Transcribing' :
        'Voice input'
      }
    >
      {stage === 'transcribing' ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons name={icon as any} size={size} color={tint} />
      )}
      {stage === 'recording' && (
        <View style={s.recDot} />
      )}
      {!!errMsg && stage === 'error' && (
        <Text style={s.errText} numberOfLines={2}>{errMsg}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 4, paddingVertical: 4,
  },
  recDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.error,
  },
  errText: {
    fontSize: 10, color: Colors.error, maxWidth: 140,
  },
});
