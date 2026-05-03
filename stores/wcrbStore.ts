/**
 * Global WCRB playback controller.
 *
 * Owns the singleton HTMLAudioElement so the play state persists
 * across navigation and is shared by the bottom-nav button (mobile),
 * the sidebar widget (desktop), and the profile-hub compact card.
 *
 * Tap any of those surfaces and the others reflect the new state
 * because they all read from this store.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';

const STREAM_URLS = [
  'https://wgbh-live.streamguys1.com/WCRB.mp3',
  'https://wgbh-live.streamguys1.com/classical-hi',
  'https://wgbh-live.streamguys1.com/crb-dream',
  'https://wgbh-live.streamguys1.com/crb-dream-aac',
  'https://wgbh-live.streamguys1.com/wgbh.mp3',
];

interface WCRBState {
  playing: boolean;
  loading: boolean;
  error: string | null;
  toggle: () => Promise<void>;
}

let audio: HTMLAudioElement | null = null;
let urlIdx = 0;

function ensureAudio(set: (patch: Partial<WCRBState>) => void): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'none';
  a.src = STREAM_URLS[0];
  a.addEventListener('playing', () => set({ playing: true, loading: false, error: null }));
  a.addEventListener('pause', () => set({ playing: false }));
  a.addEventListener('ended', () => set({ playing: false }));
  a.addEventListener('waiting', () => set({ loading: true }));
  a.addEventListener('canplay', () => set({ loading: false }));
  a.addEventListener('error', () => {
    urlIdx += 1;
    if (urlIdx < STREAM_URLS.length) {
      a.src = STREAM_URLS[urlIdx];
      // If user wanted us playing, retry the next URL automatically.
      if (!a.paused) a.play().catch(() => {});
    } else {
      set({ playing: false, loading: false, error: 'Stream offline' });
      urlIdx = 0;
      a.src = STREAM_URLS[0];
    }
  });
  audio = a;
  return a;
}

export const useWCRB = create<WCRBState>((set, get) => ({
  playing: false,
  loading: false,
  error: null,
  toggle: async () => {
    const a = ensureAudio(set);
    if (!a) return;
    set({ error: null });
    try {
      if (a.paused) {
        urlIdx = 0;
        a.src = STREAM_URLS[0];
        set({ loading: true });
        await a.play();
      } else {
        a.pause();
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[WCRB] play() rejected', e);
      set({ playing: false, loading: false, error: e?.message ?? 'Could not start the stream.' });
    }
  },
}));
