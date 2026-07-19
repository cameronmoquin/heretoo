/**
 * The Parlor — HereToo's editorial collection.
 *
 * Source of Truth, Milestone 11. Twelve essays across the editorial
 * year, each one written rather than optimized. Two are shipped at
 * launch; the remaining ten land one at a time as drafts move through
 * the human author.
 *
 * Tone rules for parlor essays (Source of Truth, M11):
 *   - No em dashes.
 *   - No adverbs on action.
 *   - No interiority or figurative language unless quoting.
 *   - No weather-as-mood.
 *   - No "Not X but Y" formulations.
 *   - No "just as / the way" openers.
 *   - No trailing negatives.
 */

export type ParlorIntent = 'helper' | 'naming' | 'latent';

export interface ParlorEssay {
  slug: string;
  title: string;
  /** One-sentence summary; meta description for SEO. */
  description: string;
  /** Helper / naming / latent — the SEO posture. */
  intent: ParlorIntent;
  publishedAt: string; // ISO date
  updatedAt?: string;
  /** When false, the essay appears in the editorial calendar but is
   *  not yet readable. The /the-parlor index lists it as "Forthcoming." */
  published: boolean;
  /** Body in plain prose paragraphs. Each entry is one paragraph; the
   *  reader joins them with the spec's 1.7 line-height + paragraph spacing. */
  body?: string[];
  /** Internal links (other parlor slugs) — the spec calls for two
   *  internal links per essay so the parlor builds a graph. */
  related?: string[];
}

export const PARLOR_ESSAYS: ParlorEssay[] = [
  // ── Forthcoming, in editorial order ─────────────────────────────────
  // (The grandparent-pitch entries were cut 2026-07 with the rest of the
  //  "safe place for families" marketing. The parlor keeps its neutral
  //  essays; new editorial direction lands with the new voice.)
  {
    slug: 'why-your-family-group-chat-keeps-dying',
    title: 'Why your family group chat keeps dying',
    description: 'Group chats are loud and shallow. Family deserves quiet and deep.',
    intent: 'latent',
    publishedAt: '2026-05-29',
    published: false,
  },
  {
    slug: 'a-grammar-of-family-stories',
    title: 'A grammar of family stories',
    description: 'Subjects explained as the way memory actually works.',
    intent: 'latent',
    publishedAt: '2026-06-19',
    published: false,
  },
  {
    slug: 'on-reading-aloud',
    title: 'On reading aloud',
    description: 'Embodied perception, and the case for a calm friend reading the day to you.',
    intent: 'latent',
    publishedAt: '2026-06-26',
    published: false,
  },
  {
    slug: 'the-five-rhythms',
    title: 'The five rhythms',
    description: 'The Anniversary Engine as a meditation on family time.',
    intent: 'latent',
    publishedAt: '2026-07-03',
    published: false,
  },
  {
    slug: 'best-apps-for-keeping-your-family-connected',
    title: 'Best apps for keeping your family connected (a short list)',
    description: 'A genuinely fair list. HereToo is one entry; we name the strengths of the others.',
    intent: 'helper',
    publishedAt: '2026-07-10',
    published: false,
  },
];

export function getEssay(slug: string): ParlorEssay | undefined {
  return PARLOR_ESSAYS.find((e) => e.slug === slug);
}

export function getPublishedEssays(): ParlorEssay[] {
  return PARLOR_ESSAYS.filter((e) => e.published).sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  );
}

export function getForthcomingEssays(): ParlorEssay[] {
  return PARLOR_ESSAYS.filter((e) => !e.published).sort(
    (a, b) => a.publishedAt.localeCompare(b.publishedAt),
  );
}
