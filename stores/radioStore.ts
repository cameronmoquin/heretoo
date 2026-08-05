/**
 * Global radio playback controller — generalized from the original
 * WCRB-only player to support a curated catalogue of stations.
 *
 * Owns the singleton HTMLAudioElement so playback state persists across
 * navigation and is shared by the bottom-nav button (mobile), sidebar
 * widget (desktop), profile-hub compact card, and the /music station-
 * picker page.
 *
 * Tap any of those surfaces and the others reflect the new state — they
 * all read from this store. Selecting a different station while the
 * current one is playing seamlessly switches; pause is a separate state.
 *
 * Stations are vetted for playable HTTPS streams. Each entry carries a
 * primary URL plus optional fallbacks (StreamGuys etc. occasionally
 * shuffle endpoints) — if the primary fails, we walk the fallback list.
 *
 * Coordinates with the TTS read-aloud singleton: starting the radio
 * pauses any in-flight TTS, and starting TTS pauses the radio. Only
 * one audio source can have the user's attention at once.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export interface RadioStation {
  id: string;
  /** Display name. */
  name: string;
  /** Genre / format tag — "classical", "jazz", "indie", "talk", etc. */
  genre: string;
  /** City / market for context. */
  city: string;
  /** Stream URL list — first that loads wins. */
  streams: string[];
  /** Optional homepage / "more info" link. */
  url?: string;
}

/**
 * Curated station catalogue. All HTTPS, all confirmed publicly streaming
 * as of this build. Mix of: NPR talk, public-radio classical, college
 * indie, jazz, free-form, BBC, internet-only (SomaFM). Lean toward "the
 * radio industry getting a boost" — independent, listener-supported,
 * non-algorithmic — over major commercial chains.
 *
 * To add a station: confirm an HTTPS .mp3 / .aac stream URL, add a row.
 * Browser autoplay rules require user-initiated play, which the toggle
 * already does.
 */
export const STATIONS: RadioStation[] = [
  // ── Classical ────────────────────────────────────────────────────────
  {
    id: 'wcrb',
    name: '99.5 WCRB',
    genre: 'classical',
    city: 'Boston',
    streams: [
      'https://wgbh-live.streamguys1.com/WCRB.mp3',
      'https://wgbh-live.streamguys1.com/classical-hi',
      'https://wgbh-live.streamguys1.com/crb-dream',
    ],
    url: 'https://www.classicalwcrb.org',
  },
  {
    id: 'kingfm',
    name: 'King FM',
    genre: 'classical',
    city: 'Seattle',
    streams: ['https://classicalking.streamguys1.com/king-fm-mp3-128'],
    url: 'https://www.king.org',
  },

  // ── Jazz ─────────────────────────────────────────────────────────────
  {
    id: 'wwoz',
    name: 'WWOZ 90.7',
    genre: 'jazz',
    city: 'New Orleans',
    streams: ['https://wwoz-sc.streamguys1.com/wwoz-hi.mp3'],
    url: 'https://www.wwoz.org',
  },

  // ── Indie / eclectic ─────────────────────────────────────────────────
  {
    id: 'kexp',
    name: 'KEXP 90.3',
    genre: 'indie',
    city: 'Seattle',
    streams: ['https://kexp-mp3-128.streamguys1.com/kexp128.mp3'],
    url: 'https://www.kexp.org',
  },
  {
    id: 'kcrw_eclectic',
    name: 'KCRW Eclectic 24',
    genre: 'eclectic',
    city: 'Los Angeles',
    streams: ['https://kcrw.streamguys1.com/kcrw_192k_mp3_e24'],
    url: 'https://www.kcrw.com',
  },
  {
    id: 'wfmu',
    name: 'WFMU',
    genre: 'free-form',
    city: 'Jersey City',
    streams: ['https://stream0.wfmu.org/freeform-128k'],
    url: 'https://wfmu.org',
  },
  {
    id: 'wfuv',
    name: 'WFUV 90.7',
    genre: 'adult alt',
    city: 'New York',
    streams: ['https://onair.wfuv.org/onair-hi.mp3'],
    url: 'https://wfuv.org',
  },

  // ── Talk / NPR ───────────────────────────────────────────────────────
  {
    id: 'wbur',
    name: 'WBUR 90.9',
    genre: 'talk',
    city: 'Boston',
    streams: ['https://audio.wbur.org/stream/live_mp3'],
    url: 'https://www.wbur.org',
  },
  {
    id: 'wnyc',
    name: 'WNYC FM',
    genre: 'talk',
    city: 'New York',
    streams: ['https://fm939.wnyc.org/wnycfm-mobile.aac'],
    url: 'https://www.wnyc.org',
  },

  // ── BBC ─────────────────────────────────────────────────────────────
  {
    id: 'bbc_6music',
    name: 'BBC 6 Music',
    genre: 'alternative',
    city: 'London',
    streams: ['https://stream.live.vc.bbcmedia.co.uk/bbc_6music'],
    url: 'https://www.bbc.co.uk/sounds/play/live:bbc_6music',
  },
  {
    id: 'bbc_radio4',
    name: 'BBC Radio 4',
    genre: 'talk',
    city: 'London',
    streams: ['https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm'],
    url: 'https://www.bbc.co.uk/sounds/play/live:bbc_radio_fourfm',
  },

  // ── Internet-only ────────────────────────────────────────────────────
  {
    id: 'somafm_groove',
    name: 'SomaFM Groove Salad',
    genre: 'downtempo',
    city: 'San Francisco',
    streams: ['https://ice2.somafm.com/groovesalad-128-mp3'],
    url: 'https://somafm.com/groovesalad/',
  },
  {
    id: 'somafm_indie',
    name: 'SomaFM Indie Pop Rocks',
    genre: 'indie',
    city: 'San Francisco',
    streams: ['https://ice2.somafm.com/indiepop-128-mp3'],
    url: 'https://somafm.com/indiepop/',
  },
  {
    id: 'radioparadise',
    name: 'Radio Paradise',
    genre: 'eclectic',
    city: 'listener-built',
    streams: ['https://stream.radioparadise.com/mp3-192'],
    url: 'https://radioparadise.com',
  },

  // ── Boomer-era stations ──────────────────────────────────────────
  // Curated free streams of music from the 50s/60s/70s/80s. Same
  // ad-free policy as the rest of our station list — these are the
  // listener-supported public streams, not commercial broadcasts.
  {
    id: 'absolute-oldies',
    name: 'Absolute Oldies',
    genre: '50s & 60s',
    city: 'curated · free',
    streams: [
      'https://strm112.1.fm/oldies_mobile_mp3',
      'https://strm112.2.fm/oldies_mobile_mp3',
    ],
    url: 'https://1.fm/onair/absoluteoldies',
  },
  {
    id: 'absolute-70s',
    name: 'Absolute 70s',
    genre: '1970s',
    city: 'curated · free',
    streams: [
      'https://strm112.1.fm/seventies_mobile_mp3',
      'https://strm112.2.fm/seventies_mobile_mp3',
    ],
    url: 'https://1.fm/onair/absolute70s',
  },
  {
    id: 'absolute-80s',
    name: 'Absolute 80s',
    genre: '1980s',
    city: 'curated · free',
    streams: [
      'https://strm112.1.fm/eightiesfusion_mobile_mp3',
      'https://strm112.2.fm/eightiesfusion_mobile_mp3',
    ],
    url: 'https://1.fm/onair/absolute80s',
  },
  {
    id: 'somafm-poptron',
    name: 'SomaFM PopTron',
    genre: 'classic pop',
    city: 'San Francisco',
    streams: ['https://ice5.somafm.com/poptron-128-mp3'],
    url: 'https://somafm.com/poptron/',
  },
];

const DEFAULT_STATION_ID = 'wcrb';

interface RadioState {
  /** id of the currently selected station (whether playing or not). */
  stationId: string;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Switch stations. Auto-plays if was playing, stays paused otherwise. */
  setStation: (id: string) => Promise<void>;
  /** Toggle play/pause for the current station. */
  toggle: () => Promise<void>;
  /** Duck the volume to ~30% — used while TTS is reading. Idempotent;
   *  multiple ducks at once stack to the same level. */
  duck: () => void;
  /** Restore from duck. Safe to call even when not ducked. */
  unduck: () => void;
}

const STORAGE_KEY = 'heretoo:radio-station';

function loadInitialId(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v && STATIONS.some((s) => s.id === v)) return v;
    } catch {}
  }
  return DEFAULT_STATION_ID;
}

function persistId(id: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch {}
}

/** Best-effort sync of station choice to profiles.style_prefs.radio_station_id */
async function syncStationToProfile(id: string) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;
    const { data: cur } = await supabase
      .from('profiles')
      .select('style_prefs')
      .eq('id', userId)
      .maybeSingle();
    const next = { ...((cur as any)?.style_prefs ?? {}), radio_station_id: id };
    await supabase.from('profiles').update({ style_prefs: next }).eq('id', userId);
  } catch {}
}

let audio: HTMLAudioElement | null = null;
let urlIdx = 0;

function ensureAudio(set: (patch: Partial<RadioState>) => void): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'none';
  a.addEventListener('playing', () => set({ playing: true, loading: false, error: null }));
  a.addEventListener('pause', () => set({ playing: false }));
  a.addEventListener('ended', () => set({ playing: false }));
  a.addEventListener('waiting', () => set({ loading: true }));
  a.addEventListener('canplay', () => set({ loading: false }));
  a.addEventListener('error', () => {
    // Walk the fallback list for the current station.
    const station = STATIONS.find((s) => s.id === currentStationIdRef);
    if (!station) {
      set({ playing: false, loading: false, error: 'Station unavailable' });
      return;
    }
    urlIdx += 1;
    if (urlIdx < station.streams.length) {
      a.src = station.streams[urlIdx];
      if (!a.paused) a.play().catch(() => {});
    } else {
      set({ playing: false, loading: false, error: 'Stream offline' });
      urlIdx = 0;
    }
  });
  audio = a;
  return a;
}

// Tracked outside the store so the audio error handler can read it
// without going through Zustand getState() inside an event listener
// (which would risk stale reads with re-renders).
let currentStationIdRef = DEFAULT_STATION_ID;

export const useRadio = create<RadioState>((set, get) => ({
  stationId: (() => {
    const id = loadInitialId();
    currentStationIdRef = id;
    return id;
  })(),
  playing: false,
  loading: false,
  error: null,

  setStation: async (id) => {
    if (!STATIONS.some((s) => s.id === id) || id === get().stationId) {
      // No-op for invalid id or same station.
      if (id === get().stationId) {
        // Same station — maybe the user re-selected. Persist + sync
        // anyway in case localStorage was cleared.
        persistId(id);
        void syncStationToProfile(id);
      }
      return;
    }
    const wasPlaying = get().playing;
    currentStationIdRef = id;
    urlIdx = 0;
    set({ stationId: id, error: null });
    persistId(id);
    void syncStationToProfile(id);

    if (wasPlaying) {
      // Seamless switch — load the new primary stream and resume play.
      const a = ensureAudio(set);
      if (a) {
        const station = STATIONS.find((s) => s.id === id)!;
        a.src = station.streams[0];
        set({ loading: true });
        try { await a.play(); } catch (e: any) {
          set({ playing: false, loading: false, error: e?.message ?? 'Could not start.' });
        }
      }
    }
  },

  toggle: async () => {
    const a = ensureAudio(set);
    if (!a) return;
    set({ error: null });
    const station = STATIONS.find((s) => s.id === get().stationId);
    if (!station) {
      set({ error: 'Station not found' });
      return;
    }
    try {
      if (a.paused) {
        // Pause TTS read-aloud before starting radio (lazy import to
        // avoid a hard module cycle — both stores reference each other).
        try {
          const ttsMod = await import('./ttsStore');
          ttsMod.useTTS.getState().stop();
        } catch {}
        urlIdx = 0;
        a.src = station.streams[0];
        set({ loading: true });
        await a.play();
      } else {
        a.pause();
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[radio] play() rejected', e);
      set({ playing: false, loading: false, error: e?.message ?? 'Could not start the stream.' });
    }
  },

  // M6: when read-aloud starts, duck the radio rather than pause it.
  // Music ducking is gentler — the user keeps the ambient feel and
  // hears the read-aloud over it. Volume restores when read-aloud ends.
  duck: () => {
    if (audio) audio.volume = 0.3;
  },
  unduck: () => {
    if (audio) audio.volume = 1.0;
  },
}));

/** Convenience: get the active station definition. */
export function useActiveStation(): RadioStation {
  const id = useRadio((s) => s.stationId);
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}
