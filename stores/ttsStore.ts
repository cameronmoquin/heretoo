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
 * Coordinates with the radio: starting TTS DUCKS the radio to 30%
 * volume rather than pausing it (Source of Truth, Milestone 6 —
 * "music ducks to 30% during reading"). Voice over a low-volume
 * station is the cinematic mood the platform wants.
 *
 * Pace calibration: user can set 0.85× / 1.0× / 1.15× via the
 * art-preferences settings panel. Persisted to localStorage on web.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { useRadio } from './radioStore';

export type TTSPace = 0.85 | 1.0 | 1.15;

interface TTSState {
  /** Stable id of the clip currently selected — typically a postId. */
  currentId: string | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Playback rate, 0.85× / 1.0× / 1.15×. Persisted on web. */
  pace: TTSPace;
  /** Toggle: if same id is currently playing, pause. Otherwise switch. */
  toggle: (id: string, text: string) => Promise<void>;
  /** Read a sequence of items end-to-end. Each {id,text} plays in
   *  order, with a small breath between. Used by the Room's
   *  "Read me today" button. */
  playSequence: (items: Array<{ id: string; text: string }>) => Promise<void>;
  stop: () => void;
  setPace: (pace: TTSPace) => void;
}

const PACE_KEY = 'heretoo:tts-pace';

function loadInitialPace(): TTSPace {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 1.0;
  try {
    const v = parseFloat(window.localStorage.getItem(PACE_KEY) ?? '1');
    if (v === 0.85 || v === 1.0 || v === 1.15) return v as TTSPace;
  } catch {}
  return 1.0;
}

function persistPace(p: TTSPace) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.localStorage.setItem(PACE_KEY, String(p)); } catch {}
}

let audio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
// Sequence playback uses an internal queue; one shared queue at a time.
let sequenceQueue: Array<{ id: string; text: string }> = [];
let sequenceActive = false;

function disposeUrl() {
  if (currentObjectUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(currentObjectUrl);
  }
  currentObjectUrl = null;
}

/** Fetch + buffer one TTS clip and start it playing. Used both by
 *  toggle() (single play) and playSequence() (chained). */
async function fetchAndPlay(
  id: string,
  text: string,
  set: (patch: Partial<TTSState>) => void,
  pace: TTSPace,
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // Switching clips — tear down the prior one and free its URL.
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  disposeUrl();

  set({ currentId: id, loading: true, playing: false, error: null });

  let blob: Blob;
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, pace }),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error ?? `TTS failed (${res.status})`);
    }
    blob = await res.blob();
  } catch (e: any) {
    set({ loading: false, playing: false, error: e?.message ?? 'TTS request failed' });
    sequenceActive = false;
    sequenceQueue = [];
    useRadio.getState().unduck();
    return;
  }

  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;

  if (!audio) {
    audio = new Audio();
    // Sequence-aware ended: chain to the next item if any.
    audio.addEventListener('ended', () => {
      set({ playing: false });
      if (sequenceActive && sequenceQueue.length > 0) {
        const next = sequenceQueue.shift()!;
        // Tiny breath between postcards — 600ms.
        setTimeout(() => { fetchAndPlay(next.id, next.text, set, useTTS.getState().pace); }, 600);
      } else if (sequenceActive) {
        sequenceActive = false;
        useRadio.getState().unduck();
      } else {
        useRadio.getState().unduck();
      }
    });
    audio.addEventListener('pause', () => {
      set({ playing: false });
    });
    audio.addEventListener('playing', () => {
      set({ playing: true, loading: false, error: null });
      useRadio.getState().duck();
    });
    audio.addEventListener('error', () => {
      set({ playing: false, loading: false, error: 'Audio playback error' });
      sequenceActive = false;
      sequenceQueue = [];
      useRadio.getState().unduck();
    });
  }

  audio.src = url;
  // Apply user's pace setting via HTMLAudioElement.playbackRate. This
  // is a client-side speedup; ElevenLabs doesn't expose pace in their
  // voice_settings API for the turbo model.
  audio.playbackRate = pace;

  try {
    await audio.play();
  } catch (e: any) {
    set({ playing: false, loading: false, error: e?.message ?? 'Could not start audio' });
    sequenceActive = false;
    sequenceQueue = [];
    useRadio.getState().unduck();
  }
}

export const useTTS = create<TTSState>((set, get) => ({
  currentId: null,
  playing: false,
  loading: false,
  error: null,
  pace: loadInitialPace(),

  toggle: async (id, text) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // If this id is already the active clip, pause/resume in place
    // rather than re-fetching audio. Single-clip mode cancels any
    // sequence playback.
    if (audio && get().currentId === id && !sequenceActive) {
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

    // Cancel any in-flight sequence — this is a single-item play.
    sequenceActive = false;
    sequenceQueue = [];

    await fetchAndPlay(id, text, set, get().pace);
  },

  playSequence: async (items) => {
    if (items.length === 0) return;
    sequenceQueue = items.slice(1);
    sequenceActive = true;
    const first = items[0];
    await fetchAndPlay(first.id, first.text, set, get().pace);
  },

  stop: () => {
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    disposeUrl();
    sequenceActive = false;
    sequenceQueue = [];
    useRadio.getState().unduck();
    set({ currentId: null, playing: false, loading: false });
  },

  setPace: (pace) => {
    set({ pace });
    persistPace(pace);
    // Live-apply to anything currently playing.
    if (audio) audio.playbackRate = pace;
  },
}));
