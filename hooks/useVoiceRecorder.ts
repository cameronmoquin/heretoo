/**
 * useVoiceRecorder — web microphone capture for the memoir interview.
 *
 * Records via MediaRecorder, returns the captured audio as a Blob on
 * stop. Web-only (MediaRecorder is a browser API); callers should
 * gate the mic UI on isSupported. Keyboard input remains the fallback
 * everywhere this isn't available.
 */

import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface VoiceRecorder {
  isSupported: boolean;
  recording: boolean;
  error: string | null;
  /** Begin capture. Prompts for mic permission on first use. */
  start: () => Promise<void>;
  /** Stop capture and resolve with the recorded audio (or null). */
  stop: () => Promise<{ blob: Blob; mime: string } | null>;
  /** Abort without producing audio (e.g. user cancels). */
  cancel: () => void;
}

function detectSupport(): boolean {
  return (
    Platform.OS === 'web'
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof (globalThis as any).MediaRecorder !== 'undefined'
  );
}

// Pick a mime the browser actually supports. Chrome → webm/opus,
// Safari → mp4. Whisper accepts both.
function pickMime(): string {
  const MR: any = (globalThis as any).MediaRecorder;
  if (!MR?.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  return '';
}

export function useVoiceRecorder(): VoiceRecorder {
  const isSupported = detectSupport();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setError('Recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const MR: any = (globalThis as any).MediaRecorder;
      const rec = mime ? new MR(stream, { mimeType: mime }) : new MR(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e: any) {
      teardownStream();
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : 'Could not start recording.',
      );
    }
  }, [isSupported, teardownStream]);

  const stop = useCallback(() => {
    return new Promise<{ blob: Blob; mime: string } | null>((resolve) => {
      const rec = recorderRef.current;
      if (!rec) { resolve(null); return; }
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        recorderRef.current = null;
        teardownStream();
        setRecording(false);
        resolve(blob.size > 0 ? { blob, mime } : null);
      };
      try { rec.stop(); } catch { resolve(null); }
    });
  }, [teardownStream]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) { try { rec.stop(); } catch {} }
    chunksRef.current = [];
    recorderRef.current = null;
    teardownStream();
    setRecording(false);
  }, [teardownStream]);

  return { isSupported, recording, error, start, stop, cancel };
}
