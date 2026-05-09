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
  | 'art-deco'
  | 'morris-trellis'
  | 'morris-willow'
  | 'moorish-star'
  | 'dude-rug'
  | 'morris-trellis-original'
  | 'morris-arcadia'
  | 'morris-daisy'
  | 'morris-fruit'
  | 'morris-jasmine'
  | 'voysey-tulip'
  | 'demorgan-blue-dragon'
  | 'demorgan-tile'
  | 'owen-jones-035'
  | 'owen-jones-043'
  | 'owen-jones-059'
  | 'owen-jones-062'
  | 'katagami-floral';

/** Curatorial school used to group patterns in the picker.
 *  Source of Truth, Milestone 2: "the picker becomes a small museum,
 *  patterns grouped by school." */
export type WallpaperSchool =
  | 'arts-and-crafts'
  | 'persian'
  | 'moresque'
  | 'celtic'
  | 'japanese'
  | 'modernist'
  | 'misc';

export interface WallpaperDef {
  id: WallpaperId;
  label: string;
  era: string;
  /** Inline SVG used as a data-URI background-image on web. Tiles. */
  svg: string;
  /** Tile size in CSS px when applied. Smaller = denser pattern. */
  tileSize: number;
  /** Hex of the pattern's base ink color (used for the picker swatch). */
  swatchInk: string;
  /** Hex of the pattern's background color (used for the picker swatch). */
  swatchBg: string;
  /** Optional URL to a full-bleed image (rendered with `background-size:
   *  cover`, no tiling). Takes precedence over `svg` when set. Used for
   *  high-res photographic public-domain wallpaper scans served from
   *  /public/wallpapers/. */
  imageUrl?: string;
  /** Credit line shown in the picker for image-mode wallpapers. */
  credit?: string;
  /** Curatorial school for the picker grouping. */
  school?: WallpaperSchool;
  /** One-paragraph context shown in the picker's "About this pattern"
   *  affordance. Source of Truth, M2: "patterns grouped by school,
   *  each with a one-paragraph card that names the artist, the year,
   *  and one sentence of context." */
  about?: string;
  /** Year the pattern was first produced (display-only). */
  year?: number;
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

  // ─── Morris Trellis — Arts & Crafts ─────────────────────────────────
  // Inspired by William Morris's 1862 "Trellis" — his FIRST wallpaper
  // design (PD, his death + 70yrs lapsed long ago). Diamond trellis of
  // rose canes with a five-petal rose at each crossing. Re-drawn from
  // scratch as a clean tiling SVG; not traced from any single scan.
  'morris-trellis': {
    id: 'morris-trellis',
    label: 'Morris Trellis',
    era: 'Morris, 1862',
    swatchInk: '#7A9166',
    swatchBg: '#EFEAD8',
    tileSize: 80,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'>
      <rect width='80' height='80' fill='#EFEAD8'/>
      <g stroke='#7A9166' stroke-width='1.3' fill='none' opacity='0.9'>
        <path d='M0 0 L80 80'/><path d='M80 0 L0 80'/>
        <path d='M40 0 Q50 20 40 40 Q30 60 40 80'/>
        <path d='M0 40 Q20 50 40 40 Q60 30 80 40'/>
      </g>
      <g fill='#B6536A' opacity='0.85'>
        <circle cx='40' cy='40' r='3.6'/>
        <circle cx='0' cy='0' r='3.2'/><circle cx='80' cy='0' r='3.2'/>
        <circle cx='0' cy='80' r='3.2'/><circle cx='80' cy='80' r='3.2'/>
      </g>
      <g fill='#7A9166' opacity='0.7'>
        <ellipse cx='20' cy='20' rx='4' ry='2' transform='rotate(45 20 20)'/>
        <ellipse cx='60' cy='60' rx='4' ry='2' transform='rotate(45 60 60)'/>
        <ellipse cx='60' cy='20' rx='4' ry='2' transform='rotate(-45 60 20)'/>
        <ellipse cx='20' cy='60' rx='4' ry='2' transform='rotate(-45 20 60)'/>
      </g>
    </svg>`,
  },

  // ─── Morris Willow Bough — Arts & Crafts ────────────────────────────
  // Inspired by Morris's 1887 "Willow Bough" — flowing pointed willow
  // leaves on a soft sage ground. PD source.
  'morris-willow': {
    id: 'morris-willow',
    label: 'Willow Bough',
    era: 'Morris, 1887',
    swatchInk: '#5E7A4B',
    swatchBg: '#E5E8D6',
    tileSize: 72,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'>
      <rect width='72' height='72' fill='#E5E8D6'/>
      <g fill='#5E7A4B' opacity='0.78'>
        <path d='M10 8 Q20 20 14 36 Q8 24 10 8 Z'/>
        <path d='M40 4 Q52 16 46 32 Q38 20 40 4 Z'/>
        <path d='M22 30 Q34 42 28 56 Q20 44 22 30 Z'/>
        <path d='M52 36 Q66 48 58 64 Q48 52 52 36 Z'/>
        <path d='M4 50 Q16 62 8 72 Q-2 60 4 50 Z'/>
      </g>
      <g stroke='#5E7A4B' stroke-width='0.7' fill='none' opacity='0.55'>
        <path d='M14 36 Q22 44 28 56'/>
        <path d='M46 32 Q50 36 52 36'/>
        <path d='M58 64 Q60 68 64 72'/>
      </g>
    </svg>`,
  },

  // ─── Moorish Star — Owen Jones, Grammar of Ornament 1856 ────────────
  // 8-point interlaced star from Plate XLI ("Moresque No. 4"). PD
  // source. Geometric, Andalusian; the visual ancestor of Escher.
  'moorish-star': {
    id: 'moorish-star',
    label: 'Moorish Star',
    era: 'Jones, 1856',
    swatchInk: '#1F4E5C',
    swatchBg: '#F2E6C9',
    tileSize: 64,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
      <rect width='64' height='64' fill='#F2E6C9'/>
      <g stroke='#1F4E5C' stroke-width='1.4' fill='none' stroke-linejoin='miter'>
        <path d='M32 4 L40 24 L60 32 L40 40 L32 60 L24 40 L4 32 L24 24 Z'/>
        <path d='M32 12 L37 27 L52 32 L37 37 L32 52 L27 37 L12 32 L27 27 Z'/>
      </g>
      <g fill='#B05B2C' opacity='0.85'>
        <circle cx='32' cy='32' r='2.4'/>
        <circle cx='0' cy='0' r='2'/><circle cx='64' cy='0' r='2'/>
        <circle cx='0' cy='64' r='2'/><circle cx='64' cy='64' r='2'/>
      </g>
      <g stroke='#B05B2C' stroke-width='0.6' fill='none' opacity='0.6'>
        <path d='M0 32 L8 32'/><path d='M56 32 L64 32'/>
        <path d='M32 0 L32 8'/><path d='M32 56 L32 64'/>
      </g>
    </svg>`,
  },

  // ─── The Dude's Rug — Heriz Persian medallion ───────────────────────
  // Cream / rust / midnight diamond medallion, stepped tribal edges,
  // a hooked vine border. Inspired by the rug from The Big Lebowski
  // (1998) — the rug really tied the room together. The rug pattern
  // itself is a centuries-old Heriz/Bidjar style; the film didn't
  // invent it, so this is fine to reproduce.
  'dude-rug': {
    id: 'dude-rug',
    label: "The Dude's Rug",
    era: 'Heriz, 19th c.',
    swatchInk: '#9C3B1F',
    swatchBg: '#E8D9B3',
    tileSize: 96,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
      <rect width='96' height='96' fill='#E8D9B3'/>
      <!-- outer hooked border -->
      <g stroke='#1C2238' stroke-width='1.4' fill='none'>
        <rect x='2' y='2' width='92' height='92'/>
        <rect x='8' y='8' width='80' height='80'/>
      </g>
      <g fill='#1C2238'>
        <path d='M2 24 L8 24 L8 28 L2 28 Z'/>
        <path d='M2 68 L8 68 L8 72 L2 72 Z'/>
        <path d='M88 24 L94 24 L94 28 L88 28 Z'/>
        <path d='M88 68 L94 68 L94 72 L88 72 Z'/>
        <path d='M24 2 L28 2 L28 8 L24 8 Z'/>
        <path d='M68 2 L72 2 L72 8 L68 8 Z'/>
        <path d='M24 88 L28 88 L28 94 L24 94 Z'/>
        <path d='M68 88 L72 88 L72 94 L68 94 Z'/>
      </g>
      <!-- central stepped diamond medallion -->
      <g fill='#9C3B1F'>
        <path d='M48 18 L62 32 L78 48 L62 64 L48 78 L34 64 L18 48 L34 32 Z'/>
      </g>
      <g fill='#E8D9B3'>
        <path d='M48 26 L56 34 L68 48 L56 62 L48 70 L40 62 L28 48 L40 34 Z'/>
      </g>
      <g fill='#1C2238'>
        <path d='M48 32 L52 36 L60 48 L52 60 L48 64 L44 60 L36 48 L44 36 Z'/>
      </g>
      <g fill='#D9A53A'>
        <circle cx='48' cy='48' r='3'/>
      </g>
      <!-- corner hooks -->
      <g fill='#9C3B1F' opacity='0.92'>
        <path d='M14 14 L22 14 L22 18 L18 18 L18 22 L14 22 Z'/>
        <path d='M82 14 L74 14 L74 18 L78 18 L78 22 L82 22 Z'/>
        <path d='M14 82 L22 82 L22 78 L18 78 L18 74 L14 74 Z'/>
        <path d='M82 82 L74 82 L74 78 L78 78 L78 74 L82 74 Z'/>
      </g>
    </svg>`,
  },

  // ─── Real Morris scans — high-res, served full-bleed (no tile) ──────
  // These are public-domain photographic scans of actual Morris designs
  // sourced from Wikimedia Commons. Rendered with `background-size:
  // cover` so the user sees one large image, not a repeating motif.
  // All ≥1000px on the long edge, so they look crisp on most viewports.
  // Source pages all on commons.wikimedia.org under "Public domain"
  // (Morris died 1896 → expired worldwide).

  'morris-trellis-original': {
    id: 'morris-trellis-original',
    label: 'Trellis (original)',
    era: 'Morris, 1862',
    swatchInk: '#7A9166',
    swatchBg: '#EFEAD8',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/morris-trellis-original.jpg',
    credit: 'William Morris, 1862. PD (Wikimedia Commons).',
    school: 'arts-and-crafts',
    year: 1862,
    about: 'Morris’ first wallpaper. He designed Trellis after watching the roses grow on the trellis at Red House, his Bexleyheath home. Birds were drawn by his friend Philip Webb.',
  },

  'morris-arcadia': {
    id: 'morris-arcadia',
    label: 'Arcadia',
    era: 'May Morris',
    swatchInk: '#7B8E5A',
    swatchBg: '#E8E4CC',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/morris-arcadia.jpg',
    credit: 'May Morris (1862–1938). PD.',
    school: 'arts-and-crafts',
    year: 1900,
    about: 'May Morris ran the embroidery department at Morris & Co. and designed major wallpapers in her own right. Arcadia carries the family hand into the Edwardian era.',
  },

  'morris-daisy': {
    id: 'morris-daisy',
    label: 'Daisy',
    era: 'Morris, 1864',
    swatchInk: '#9FB36B',
    swatchBg: '#F0EAD0',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/morris-daisy.jpg',
    credit: 'William Morris, 1864. PD.',
    school: 'arts-and-crafts',
    year: 1864,
    about: 'Daisy was the first Morris pattern actually produced commercially. Morris drew it from a fifteenth-century Flemish illuminated manuscript he found at the British Museum.',
  },

  'morris-fruit': {
    id: 'morris-fruit',
    label: 'Fruit',
    era: 'Morris, 1866',
    swatchInk: '#8A6B43',
    swatchBg: '#E5DDC2',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/morris-fruit.jpg',
    credit: 'William Morris, c. 1866. PD.',
    school: 'arts-and-crafts',
    year: 1866,
    about: 'Also called Pomegranate. Morris paired ripening fruit with leaf branches that interlock at the corners — one of the first repeats designed to read as a single field across a whole wall.',
  },

  'morris-jasmine': {
    id: 'morris-jasmine',
    label: 'Jasmine',
    era: 'Morris, 1872',
    swatchInk: '#5E7A4B',
    swatchBg: '#E8E5D0',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/morris-jasmine.png',
    credit: 'William Morris, 1872. PD.',
    school: 'arts-and-crafts',
    year: 1872,
    about: 'A trailing jasmine repeat by William Morris, drawn the year his firm reorganized as Morris & Co. Co-designed with his daughter May, who would carry the firm.',
  },

  // ─── C.F.A. Voysey — Arts and Crafts ────────────────────────────────
  'voysey-tulip': {
    id: 'voysey-tulip',
    label: 'Tulip',
    era: 'Voysey, c. 1896',
    swatchInk: '#7C9456',
    swatchBg: '#F0EBD8',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/voysey-tulip.jpg',
    credit: 'Charles Francis Annesley Voysey. Google Art Project / Wikimedia Commons. PD.',
    school: 'arts-and-crafts',
    year: 1896,
    about: 'Voysey designed for Sanderson & Sons in the years after Morris’ death. His repeats are flatter and lighter than Morris’, and his birds and tulips became the visual signature of the late Arts and Crafts moment.',
  },

  // ─── William De Morgan — Arts and Crafts (tilework) ─────────────────
  'demorgan-blue-dragon': {
    id: 'demorgan-blue-dragon',
    label: 'Blue Dragon',
    era: 'De Morgan, 1872–1904',
    swatchInk: '#2C5C7A',
    swatchBg: '#EAEDD8',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/demorgan-blue-dragon.jpg',
    credit: 'William De Morgan, c. 1872–1904. PD.',
    school: 'arts-and-crafts',
    year: 1880,
    about: 'De Morgan rediscovered the lost glazes of medieval Persian tilework and used them on Arts and Crafts ceramics. His Blue Dragon piece runs across multiple tiles to make one continuous beast.',
  },
  'demorgan-tile': {
    id: 'demorgan-tile',
    label: 'De Morgan Tile',
    era: 'De Morgan, c. 1880s',
    swatchInk: '#5C6E8A',
    swatchBg: '#E5E1CA',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/demorgan-tile.jpg',
    credit: 'William De Morgan. Google Art Project / Wikimedia Commons. PD.',
    school: 'arts-and-crafts',
    year: 1885,
    about: 'A single tile from De Morgan’s Persian-revival series. His designs lifted Iznik motifs into Victorian English homes, often paired with Morris textiles.',
  },

  // ─── Owen Jones — Grammar of Ornament (1856 / 1868) ─────────────────
  'owen-jones-035': {
    id: 'owen-jones-035',
    label: 'Moresque',
    era: 'Owen Jones, 1856',
    swatchInk: '#C24A3B',
    swatchBg: '#F4E5D2',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/owen-jones-plate-035.jpg',
    credit: 'Owen Jones, The Grammar of Ornament, 1856 (1868 edition plate 35). PD.',
    school: 'moresque',
    year: 1856,
    about: 'A plate from the Moresque chapter of Owen Jones’ Grammar. Jones documented Alhambra ornament after his 1830s travels in Granada and changed how Victorian England looked at pattern.',
  },
  'owen-jones-043': {
    id: 'owen-jones-043',
    label: 'Persian (Plate 43)',
    era: 'Owen Jones, 1856',
    swatchInk: '#1B4F7A',
    swatchBg: '#F0EBD3',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/owen-jones-plate-043.jpg',
    credit: 'Owen Jones, The Grammar of Ornament, 1856 (1868 edition plate 43). PD.',
    school: 'persian',
    year: 1856,
    about: 'From the Persian chapter. Jones’ plates were the reference text for a generation of decorators — De Morgan, Morris, and the early modernists all owned a copy.',
  },
  'owen-jones-059': {
    id: 'owen-jones-059',
    label: 'Plate 59',
    era: 'Owen Jones, 1856',
    swatchInk: '#7A4A2C',
    swatchBg: '#F0E5CC',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/owen-jones-plate-059.jpg',
    credit: 'Owen Jones, The Grammar of Ornament, 1856 (1868 edition plate 59). PD.',
    school: 'persian',
    year: 1856,
    about: 'A floral repeat from Jones’ later chapters. The Grammar of Ornament organized 100 plates around 37 “general principles” — the first systematic theory of ornament.',
  },
  'owen-jones-062': {
    id: 'owen-jones-062',
    label: 'Plate 62',
    era: 'Owen Jones, 1856',
    swatchInk: '#2E5A3B',
    swatchBg: '#EFE8CD',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/owen-jones-plate-062.jpg',
    credit: 'Owen Jones, The Grammar of Ornament, 1856 (1868 edition plate 62). PD.',
    school: 'persian',
    year: 1856,
    about: 'A leafwork repeat from Jones’ final chapters. The Grammar was reprinted continually from 1856 to 1910 and remains in print.',
  },

  // ─── Japanese katagami stencil ──────────────────────────────────────
  'katagami-floral': {
    id: 'katagami-floral',
    label: 'Katagami Floral',
    era: 'Edo / Meiji',
    swatchInk: '#5C5046',
    swatchBg: '#EFE8D8',
    tileSize: 0,
    svg: '',
    imageUrl: '/wallpapers/katagami-floral.jpg',
    credit: 'Japanese katagami stencil, late Edo / Meiji period. Wikimedia Commons. PD.',
    school: 'japanese',
    year: 1860,
    about: 'Katagami are Japanese paper stencils used to dye kimono fabric. Each was cut by hand from layers of mulberry paper laminated with persimmon juice; the lattice work that holds the design together is part of the beauty.',
  },
};

export const WALLPAPER_LIST: WallpaperDef[] = Object.values(WALLPAPERS);

/** Display order for the picker's school groupings. Schools not listed
 *  here (or wallpapers with no `school` set) fall under 'misc' last. */
export const WALLPAPER_SCHOOL_ORDER: WallpaperSchool[] = [
  'arts-and-crafts',
  'persian',
  'moresque',
  'celtic',
  'japanese',
  'modernist',
  'misc',
];

export const WALLPAPER_SCHOOL_LABELS: Record<WallpaperSchool, { title: string; blurb: string }> = {
  'arts-and-crafts': {
    title: 'Arts and Crafts',
    blurb: 'Morris and his circle. England, late 19th century. The school that argued every wall deserved a hand-drawn line.',
  },
  persian: {
    title: 'Persian',
    blurb: 'Sixteenth and seventeenth century Iranian repeats, surveyed and re-drawn by Owen Jones in 1856.',
  },
  moresque: {
    title: 'Moresque',
    blurb: 'Patterns from the Alhambra and Moorish Spain — geometric, interlaced, mathematical.',
  },
  celtic: {
    title: 'Celtic',
    blurb: 'Insular knotwork and animal interlace from medieval Ireland and Britain.',
  },
  japanese: {
    title: 'Japanese',
    blurb: 'Katagami stencils, indigo dye repeats, and Edo / Meiji-period decorative paper.',
  },
  modernist: {
    title: 'Modernist',
    blurb: 'Twentieth-century geometric patterns. Mid-century dots, Deco fans, the language of after-the-war.',
  },
  misc: {
    title: 'Other',
    blurb: 'Plain canvas, free-form, and patterns outside the major schools.',
  },
};

/** Group wallpapers by school for the picker UI. Returns groups in the
 *  order defined by WALLPAPER_SCHOOL_ORDER, each group containing the
 *  wallpapers in their original WALLPAPER_LIST order. */
export function wallpapersBySchool(): Array<{
  school: WallpaperSchool;
  label: string;
  blurb: string;
  items: WallpaperDef[];
}> {
  const groups: Record<WallpaperSchool, WallpaperDef[]> = {
    'arts-and-crafts': [],
    persian: [],
    moresque: [],
    celtic: [],
    japanese: [],
    modernist: [],
    misc: [],
  };
  for (const w of WALLPAPER_LIST) {
    const s = w.school ?? 'misc';
    groups[s].push(w);
  }
  return WALLPAPER_SCHOOL_ORDER
    .filter((s) => groups[s].length > 0)
    .map((s) => ({
      school: s,
      label: WALLPAPER_SCHOOL_LABELS[s].title,
      blurb: WALLPAPER_SCHOOL_LABELS[s].blurb,
      items: groups[s],
    }));
}

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
