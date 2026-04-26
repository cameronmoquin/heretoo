/**
 * Deterministic SVG family crest generator.
 *
 * Given a family group's id (or any stable seed), produces a small heraldic
 * shield with a hash-derived field pattern, palette, and charge. The same
 * input always produces the same crest, so a family's crest is recognizable
 * across renders without storing it.
 *
 * Output is a complete SVG string. Wrap with the Image data URI pattern in
 * components/candon/FamilyCrest.tsx for cross-platform rendering.
 */

// ── stable string hash → 32-bit unsigned ────────────────────────────────
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFromSeed(seed: string) {
  let h = hash32(seed);
  return {
    next() {
      // xorshift32
      h ^= h << 13; h >>>= 0;
      h ^= h >>> 17;
      h ^= h << 5;  h >>>= 0;
      return h;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[this.next() % arr.length];
    },
    range(min: number, max: number): number {
      return min + (this.next() % (max - min + 1));
    },
  };
}

// ── Heraldic palette: muted, classy, restrained ──────────────────────────
// Pairs of (field, charge) that sit well together. No neon — this is for
// real family marks, not gaming icons.
const PALETTES = [
  { field: '#3A4D5E', charge: '#E8DBA8', name: 'azure-or' },          // slate + warm gold
  { field: '#5B3A3A', charge: '#E8DBA8', name: 'gules-or' },           // dark red + gold
  { field: '#3F4F3A', charge: '#E8DBA8', name: 'vert-or' },            // forest + gold
  { field: '#2C2A36', charge: '#C7B7A3', name: 'sable-argent' },       // near-black + warm cream
  { field: '#4A4A6A', charge: '#D9D2BE', name: 'purpure-argent' },     // dusky purple + cream
  { field: '#7A5C3A', charge: '#F0E6CC', name: 'tenne-argent' },       // burnt umber + ivory
  { field: '#3C5A6A', charge: '#D9CFB4', name: 'azure-argent' },       // sea blue + linen
  { field: '#5A4A3A', charge: '#C8B294', name: 'brunatre-or' },        // brown + gold
] as const;

// ── Field divisions (the background pattern) ─────────────────────────────
type Division = 'plain' | 'per-pale' | 'per-fess' | 'per-bend' | 'per-bend-sinister' | 'quartered' | 'chief';

const DIVISIONS: Division[] = [
  'plain', 'per-pale', 'per-fess', 'per-bend', 'per-bend-sinister', 'quartered', 'chief',
];

// ── Charges (the central symbol) ─────────────────────────────────────────
type Charge =
  | 'chevron' | 'cross' | 'saltire' | 'fess'
  | 'pale' | 'star' | 'mullet' | 'roundel'
  | 'lozenge' | 'tower' | 'oak' | 'crescent';

const CHARGES: Charge[] = [
  'chevron', 'cross', 'saltire', 'fess', 'pale', 'star', 'mullet',
  'roundel', 'lozenge', 'tower', 'oak', 'crescent',
];

// ── Shield outline (heater shield) ───────────────────────────────────────
// 100×120 viewport: a rounded heater-shield silhouette.
const SHIELD_PATH =
  'M 6 6 L 94 6 L 94 60 C 94 86 78 104 50 114 C 22 104 6 86 6 60 Z';

// ── Charge SVG fragments (in a centered region) ──────────────────────────
function chargePath(charge: Charge, color: string): string {
  switch (charge) {
    case 'chevron':
      return `<path d="M 22 78 L 50 50 L 78 78 L 70 78 L 50 60 L 30 78 Z" fill="${color}"/>`;
    case 'cross':
      return `<rect x="46" y="28" width="8" height="56" fill="${color}"/>` +
             `<rect x="22" y="52" width="56" height="8" fill="${color}"/>`;
    case 'saltire':
      return `<path d="M 18 22 L 26 22 L 50 50 L 74 22 L 82 22 L 56 56 L 82 90 L 74 90 L 50 62 L 26 90 L 18 90 L 44 56 Z" fill="${color}"/>`;
    case 'fess':
      return `<rect x="18" y="50" width="64" height="14" fill="${color}"/>`;
    case 'pale':
      return `<rect x="42" y="22" width="16" height="64" fill="${color}"/>`;
    case 'star':
      return starPolygon(50, 56, 22, 5, color, 0.45);
    case 'mullet':
      return starPolygon(50, 56, 20, 6, color, 0.55);
    case 'roundel':
      return `<circle cx="50" cy="58" r="18" fill="${color}"/>`;
    case 'lozenge':
      return `<path d="M 50 32 L 76 58 L 50 84 L 24 58 Z" fill="${color}"/>`;
    case 'tower':
      // Crenellated tower: silhouette only.
      return `<path d="M 36 80 L 36 50 L 40 50 L 40 44 L 44 44 L 44 50 L 48 50 L 48 44 L 52 44 L 52 50 L 56 50 L 56 44 L 60 44 L 60 50 L 64 50 L 64 80 Z" fill="${color}"/>`;
    case 'oak': {
      // Stylized oak: trunk + canopy.
      return `<path d="M 50 32 C 36 32 30 44 36 54 C 30 60 34 70 44 68 C 44 76 56 76 56 68 C 66 70 70 60 64 54 C 70 44 64 32 50 32 Z" fill="${color}"/>` +
             `<rect x="48" y="68" width="4" height="14" fill="${color}"/>`;
    }
    case 'crescent':
      return `<path d="M 38 56 a 14 14 0 1 0 22 -10 a 11 11 0 1 1 -22 10 Z" fill="${color}"/>`;
  }
}

function starPolygon(cx: number, cy: number, r: number, points: number, color: string, innerRatio: number): string {
  const ri = r * innerRatio;
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : ri;
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
}

// ── Field patterns (split background) ────────────────────────────────────
function fieldFill(division: Division, fieldA: string, fieldB: string): string {
  switch (division) {
    case 'plain':
      return `<path d="${SHIELD_PATH}" fill="${fieldA}"/>`;
    case 'per-pale':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <rect x="50" y="0" width="50" height="120" fill="${fieldB}"/>
        </g>`
      );
    case 'per-fess':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <rect x="0" y="56" width="100" height="64" fill="${fieldB}"/>
        </g>`
      );
    case 'per-bend':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <polygon points="0,0 100,120 100,0" fill="${fieldB}"/>
        </g>`
      );
    case 'per-bend-sinister':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <polygon points="100,0 0,120 0,0" fill="${fieldB}"/>
        </g>`
      );
    case 'quartered':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <rect x="50" y="0" width="50" height="60" fill="${fieldB}"/>
          <rect x="0" y="60" width="50" height="60" fill="${fieldB}"/>
        </g>`
      );
    case 'chief':
      return (
        `<path d="${SHIELD_PATH}" fill="${fieldA}"/>` +
        `<g clip-path="url(#shieldClip)">
          <rect x="0" y="0" width="100" height="22" fill="${fieldB}"/>
        </g>`
      );
  }
}

// ── Initials (inscribed if division is plain or chief) ───────────────────
function initialsFromName(name: string): string {
  const parts = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Main generator ───────────────────────────────────────────────────────
export interface CrestOptions {
  /** Stable seed — usually the family group id. */
  seed: string;
  /** Optional family name; used for fallback initials in 'plain' fields. */
  name?: string;
  /** Explicit overrides — when set, take precedence over the rng-derived defaults. */
  paletteIndex?: number | null;
  division?: Division | null;
  charge?: Charge | null;
}

// Exposed for the customize UI.
export const PALETTE_LIST = PALETTES;
export const DIVISION_LIST = DIVISIONS;
export const CHARGE_LIST = CHARGES;
export type CrestDivision = Division;
export type CrestCharge = Charge;

export function generateFamilyCrestSvg({
  seed,
  name = '',
  paletteIndex,
  division: divisionOverride,
  charge: chargeOverride,
}: CrestOptions): string {
  const rng = rngFromSeed(seed);

  const defaultPalette = rng.pick(PALETTES);
  const palette =
    paletteIndex != null && paletteIndex >= 0 && paletteIndex < PALETTES.length
      ? PALETTES[paletteIndex]
      : defaultPalette;
  // 60% chance of a complementary alternate field for divided crests.
  const altPalette = PALETTES[(PALETTES.indexOf(palette) + rng.range(1, PALETTES.length - 1)) % PALETTES.length];
  const division: Division = divisionOverride ?? rng.pick(DIVISIONS);
  const charge: Charge = chargeOverride ?? rng.pick(CHARGES);

  const fieldA = palette.field;
  const fieldB = altPalette.field;
  const chargeColor = palette.charge;
  const initials = initialsFromName(name);

  // For plain fields, replace the central charge with monogram initials —
  // gives quieter, more elegant "house" crests.
  const showInitials = division === 'plain' || division === 'chief';

  const chargeSvg = showInitials
    ? `<text x="50" y="64"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-weight="700"
            font-size="36"
            fill="${chargeColor}"
            letter-spacing="1">${escapeText(initials)}</text>`
    : chargePath(charge, chargeColor);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120" role="img" aria-label="Family crest">
  <defs>
    <clipPath id="shieldClip">
      <path d="${SHIELD_PATH}"/>
    </clipPath>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  ${fieldFill(division, fieldA, fieldB)}
  ${chargeSvg}
  <path d="${SHIELD_PATH}" fill="url(#sheen)"/>
  <path d="${SHIELD_PATH}" fill="none" stroke="${chargeColor}" stroke-width="1.5" stroke-opacity="0.45"/>
</svg>`;
}

function escapeText(t: string): string {
  return t.replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c)
  );
}

/**
 * Encode an SVG string as a data URI suitable for an <Image source={uri}>.
 * Uses URL-encoding (not base64) — smaller payload and easier to debug.
 */
export function crestDataUri(svg: string): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

/** Convenience: seed + name → ready-to-use data URI. */
export function familyCrestUri(seed: string, name?: string): string {
  return crestDataUri(generateFamilyCrestSvg({ seed, name }));
}

/** Variant that honours customization overrides stored on the group row. */
export function customFamilyCrestUri(opts: CrestOptions): string {
  return crestDataUri(generateFamilyCrestSvg(opts));
}
