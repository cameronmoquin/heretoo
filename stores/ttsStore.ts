/**
 * Read-aloud playback singleton.
 *
 * One global HTMLAudioElement so only one TTS clip plays at a time
 * (tap a different post's read-aloud while one is playing → first
 * stops, second starts). Identifies the active clip by `currentId`
 * so consumer components can show a play/pause button that toggles
 * for "their" clip and only shows pause when their clip is the one
 * actually playing.
 *
 * Coordinates with the radio: starting TTS pauses the WCRB stream;
 * starting WCRB pauses TTS. Same pattern as a podcast app — only one
 * audio source can have the user's attention at once.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { useWCRB } from './wcrbStore';

interface TTSState {
  /** Stable id of the clip currently selected — typically a postId. */
  currentId: string | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Toggle: if same id is currently playing, pause. Otherwise switch. */
  toggle: (id: string, text: string) => Promise<void>;
  stop: () => void;
}

let audio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;

function disposeUrl() {
  if (currentObjectUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(currentObjectUrl);
  }
  currentObjectUrl = null;
}

export const useTTS = create<TTSState>((set, get) => ({
  currentId: null,
  playing: false,
  loading: false,
  error: null,

  toggle: async (id, text) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // If this id is already the active clip, pause/resume in place
    // rather than re-fetching audio.
    if (audio && get().currentId === id) {
      if (audio.paused) {
        try {
          await audio.play();
          set({ playing: true });
        } catch (e: any) {
          set({ playing: false, error: e?.message ?? 'Playback failed' });
        }
      } else {
        audio.pause();
        set({ playing: false });
      }
      return;
    }

    // Switching to a different clip — tear down the current one.
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    disposeUrl();

    // Pause radio if it's playing — only one audio source at a time.
    const radio = useWCRB.getState();
    if (radio.playing) {
      try { await radio.toggle(); } catch {}
    }

    set({ currentId: id, loading: true, playing: false, error: null });

    let blob: Blob;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error ?? `TTS failed (${res.status})`);
      }
      blob = await res.blob();
    } catch (e: any) {
      set({ loading: false, playing: false, error: e?.message ?? 'TTS request failed' });
      return;
    }

    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;

    if (!audio) {
      audio = new Audio();
      audio.addEventListener('ended', () => {
        set({ playing: false });
      });
      audio.addEventListener('pause', () => {
        // Don't override 'loading' or 'error' — only flip playing.
        set({ playing: false });
      });
      audio.addEventListener('playing', () => {
        set({ playing: true, loading: false, error: null });
      });
      audio.addEventListener('error', () => {
        set({ playing: false, loading: false, error: 'Audio playback error' });
      });
    }
    audio.src = url;

    try {
      await audio.play();
      // 'playing' listener will flip the state to playing:true.
    } catch (e: any) {
      set({ playing: false, loading: false, error: e?.message ?? 'Could not start audio' });
    }
  },

  stop: () => {
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    disposeUrl();
    set({ currentId: null, playing: false, loading: false });
  },
}));
