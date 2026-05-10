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
  {
    slug: 'how-to-set-up-your-mother-on-heretoo',
    title: 'How to set up your mother on HereToo',
    description:
      'A short, practical walk-through for the granddaughter at the kitchen table.',
    intent: 'helper',
    publishedAt: '2026-05-10',
    published: true,
    body: [
      'You start a family. You give it a name — "The Cottage," your last name, "Sunday Lunch," whatever feels right. The name is private; only invited people will see it.',
      'You add the people you want in the room. You can invite by phone or by email if they already use the internet, or by sending a printed welcome card by mail if they don\'t. The card has a QR code on the back. They scan it with their phone camera, hear a short greeting in a calm voice, and they\'re in. No signup form, no password to remember.',
      'Inside the family, you can post photos, write a paragraph about your day, ask the family a question, queue a long letter for delivery on a chosen date, or get on a video call. There is also a daily memoir prompt — one open question a day, the kind that produces a story. Your mother can write or speak; the platform transcribes either way.',
      'A daily email summary arrives at noon, listing what the family posted that she hasn\'t read yet. If she closes the app for two weeks, no one nags her. The room is still there when she comes back.',
      'The family subscription is five dollars a month or fifty a year, paid by whoever wants to cover it. Your mother never sees a price. The first family is free for trial.',
    ],
  },

  // ── Forthcoming, in editorial order ─────────────────────────────────
  {
    slug: 'when-your-mother-stops-posting-on-facebook',
    title: 'What to do when your mother stops posting on Facebook',
    description: 'The grandmother problem named plainly, with three honest suggestions.',
    intent: 'helper',
    publishedAt: '2026-05-15',
    published: false,
  },
  {
    slug: 'a-letter-to-my-granddaughter',
    title: 'A letter to my granddaughter, written in 2026, to be opened in 2046',
    description: 'An essay that is itself a letter; doubles as the most affecting demo of the Letter feature.',
    intent: 'latent',
    publishedAt: '2026-05-22',
    published: false,
  },
  {
    slug: 'why-your-family-group-chat-keeps-dying',
    title: 'Why your family group chat keeps dying',
    description: 'Group chats are loud and shallow. Family deserves quiet and deep.',
    intent: 'latent',
    publishedAt: '2026-05-29',
    published: false,
  },
  {
    slug: 'how-to-introduce-a-grandparent-to-a-new-app',
    title: 'How to introduce a 75-year-old to a new app',
    description: 'A short how-to for the granddaughter at the kitchen table on a Sunday afternoon.',
    intent: 'helper',
    publishedAt: '2026-06-05',
    published: false,
  },
  {
    slug: 'the-wallpaper-your-grandmother-chose',
    title: 'The wallpaper your grandmother chose',
    description: 'A short essay on William Morris, dwelling, and why your phone screen has been ugly for fifteen years.',
    intent: 'latent',
    publishedAt: '2026-06-12',
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
  {
    slug: 'how-to-write-a-letter-to-a-grandchild-not-yet-born',
    title: "How to write a letter to a grandchild who isn't born yet",
    description: 'Letter feature, future-recipient mode. Writing-craft advice that stands on its own.',
    intent: 'latent',
    publishedAt: '2026-07-17',
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
