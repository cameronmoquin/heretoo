/**
 * Wallpaper preference — what tile pattern lives behind the feed canvas.
 *
 * Wallpaper is the user's "edge decoration" — it sits on the page
 * background BEHIND cards, never on cards themselves. Cards stay on
 * a clean opaque surface so reading is undisturbed; the wallpaper
 * provides aesthetic frame, like real wallpaper around a hung canvas.
 *
 * Persisted to localStorage on web (same hand-rolled pattern as
 * artPrefsStore — zustand persist middleware was throwing on init).
 * Native is in-memory until we ship the native build, then AsyncStorage.
 *
 * Eventually: family pages will support a separate per-family wallpaper
 * that's voted on by family members and falls back to the family
 * owner's personal choice. This store handles the personal layer; the
 * family layer reads from a separate (yet-to-be-built) RPC.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export type WallpaperId =
  | 'plain'
  | 'damask'
  | 'mod-dots'
  | 'toile'
  | 'art-deco';

export interface WallpaperDef {
  id: WallpaperId;
  label: string;
  era: string;
  /** Inline SVG used as a data-URI background-image on web. */
  svg: string;
  /** Tile size in CSS px when applied. Smaller = denser pattern. */
  tileSize: number;
  /** Hex of the pattern's base ink color (used for the picker swatch). */
  swatchInk: string;
  /** Hex of the pattern's background color (used for the picker swatch). */
  swatchBg: string;
}

/**
 * Pattern atlas. Each tile is a self-contained SVG that repeats
 * cleanly. Designed to be muted by default (the WallpaperBackground
 * component applies a 35% opacity + light grayscale on top of these),
 * so the on-disk colors are intentionally a touch louder than the
 * rendered output. "Bold pattern" mode in user prefs lifts the
 * desaturation.
 */
export const WALLPAPERS: Record<WallpaperId, WallpaperDef> = {
  plain: {
    id: 'plain',
    label: 'Plain',
    era: 'No wallpaper',
    swatchInk: '#E4E4EB',
    swatchBg: '#F6F6F9',
    tileSize: 40,
    svg: '',
  },

  // ─── Damask — Victorian parlor ──────────────────────────────────────
  // Stylized quatrefoil grid. Reads as ornate but stays geometric.
  damask: {
    id: 'damask',
    label: 'Damask',
    era: 'Victorian',
    swatchInk: '#5C3A4E',
    swatchBg: '#F0E9E0',
    tileSize: 60,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'>
      <rect width='60' height='60' fill='#F0E9E0'/>
      <g fill='none' stroke='#5C3A4E' stroke-width='1.2' opacity='0.85'>
        <path d='M30 10 Q40 20 30 30 Q20 20 30 10 Z'/>
        <path d='M30 30 Q40 40 30 50 Q20 40 30 30 Z'/>
        <path d='M0 30 Q10 20 20 30 Q10 40 0 30 Z'/>
        <path d='M40 30 Q50 20 60 30 Q50 40 40 30 Z'/>
        <circle cx='30' cy='30' r='2.5' fill='#5C3A4E'/>
        <circle cx='0' cy='0' r='2' fill='#5C3A4E'/>
        <circle cx='60' cy='0' r='2' fill='#5C3A4E'/>
        <circle cx='0' cy='60' r='2' fill='#5C3A4E'/>
        <circle cx='60' cy='60' r='2' fill='#5C3A4E'/>
      </g>
    </svg>`,
  },

  // ─── Mod dots — 1960s polka ─────────────────────────────────────────
  // Orange / mustard / avocado floating circles in a relaxed lattice.
  'mod-dots': {
    id: 'mod-dots',
    label: 'Mod dots',
    era: '1960s',
    swatchInk: '#D87A2C',
    swatchBg: '#F4EBDA',
    tileSize: 48,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
      <rect width='48' height='48' fill='#F4EBDA'/>
      <circle cx='12' cy='12' r='6' fill='#D87A2C'/>
      <circle cx='36' cy='12' r='4' fill='#7C8B3F'/>
      <circle cx='24' cy='28' r='5' fill='#D9A53A'/>
      <circle cx='6' cy='38' r='3' fill='#7C8B3F'/>
      <circle cx='42' cy='40' r='5' fill='#D87A2C'/>
    </svg>`,
  },

  // ─── Toile — French country ─────────────────────────────────────────
  // Thin curved rosette on cream — the "willow stripe" of the toile
  // family, abstracted geometric.
  toile: {
    id: 'toile',
    label: 'Toile',
    era: 'French country',
    swatchInk: '#3B5683',
    swatchBg: '#F5EFE0',
    tileSize: 56,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'>
      <rect width='56' height='56' fill='#F5EFE0'/>
      <g fill='none' stroke='#3B5683' stroke-width='0.9' opacity='0.85'>
        <circle cx='28' cy='28' r='14'/>
        <circle cx='28' cy='28' r='8'/>
        <path d='M14 28 Q28 14 42 28 Q28 42 14 28 Z'/>
        <path d='M28 14 Q42 28 28 42 Q14 28 28 14 Z'/>
      </g>
      <circle cx='28' cy='28' r='2' fill='#3B5683' opacity='0.85'/>
    </svg>`,
  },

  // ─── Art Deco — 1920s Gatsby ────────────────────────────────────────
  // Radiating gold fan over deep navy.
  'art-deco': {
    id: 'art-deco',
    label: 'Art Deco',
    era: '1920s',
    swatchInk: '#D9B85F',
    swatchBg: '#1B2540',
    tileSize: 50,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 50 50'>
      <rect width='50' height='50' fill='#1B2540'/>
      <g fill='none' stroke='#D9B85F' stroke-width='1.1'>
        <path d='M25 0 L25 50'/>
        <path d='M0 25 L50 25'/>
        <path d='M0 0 L50 50'/>
        <path d='M50 0 L0 50'/>
        <circle cx='25' cy='25' r='10'/>
        <circle cx='25' cy='25' r='4' fill='#D9B85F'/>
      </g>
    </svg>`,
  },
};

export const WALLPAPER_LIST: WallpaperDef[] = Object.values(WALLPAPERS);

// ─── Persistence ────────────────────────────────────────────────────────

interface Persisted {
  id: WallpaperId;
  /** "Bold" mode: skip the default desaturation/opacity, render full
   *  strength. For users who want 100% Victorian saturation. */
  bold: boolean;
}

const STORAGE_KEY = 'heretoo:wallpaper';

function loadInitial(): Persisted {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const id: WallpaperId =
          parsed.id && parsed.id in WALLPAPERS ? parsed.id : 'plain';
        return { id, bold: !!parsed.bold };
      }
    } catch {}
  }
  return { id: 'plain', bold: false };
}

function persist(state: Persisted) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Mirror the wallpaper choice to profiles.style_prefs so OTHER viewers
 * see this user's wallpaper preference on /u/<handle>. Best-effort
 * write — RLS lets only the owner update their row, so unauthenticated
 * sessions silently no-op. Errors are swallowed; the localStorage copy
 * is always the source of truth for the OWN device.
 */
async function syncToProfile(state: Persisted) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;
    // Patch only the wallpaper keys so we don't clobber other style
    // prefs (radio station, art filter) that other stores write.
    const { data: cur } = await supabase
      .from('profiles')
      .select('style_prefs')
      .eq('id', userId)
      .maybeSingle();
    const next = {
      ...((cur as any)?.style_prefs ?? {}),
      wallpaper_id: state.id,
      wallpaper_bold: state.bold,
    };
    await supabase
      .from('profiles')
      .update({ style_prefs: next })
      .eq('id', userId);
  } catch {
    // Network blip / RLS rejection — the localStorage value still
    // works for the user's own session.
  }
}

interface WallpaperState extends Persisted {
  setWallpaper: (id: WallpaperId) => void;
  toggleBold: () => void;
}

export const useWallpaper = create<WallpaperState>((set, get) => ({
  ...loadInitial(),
  setWallpaper: (id) => {
    const state = { id, bold: get().bold };
    set({ id });
    persist(state);
    void syncToProfile(state);
  },
  toggleBold: () => {
    const state = { id: get().id, bold: !get().bold };
    set({ bold: state.bold });
    persist(state);
    void syncToProfile(state);
  },
}));

/** Returns the data-URI value for `background-image: url(...)`.
 *  Empty string for the 'plain' wallpaper. */
export function wallpaperToDataUri(def: WallpaperDef): string {
  if (!def.svg) return '';
  // encodeURIComponent is the right tool for SVG-in-data-URI on web.
  // We DON'T base64-encode because the SVG is small and URL-encoded
  // SVGs are a bit smaller AND keep `<text>` etc. searchable.
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(def.svg)}")`;
}
