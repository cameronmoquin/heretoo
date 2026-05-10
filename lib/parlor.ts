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
    slug: 'a-short-defense-of-slow-software',
    title: 'A short defense of slow software',
    description:
      'Why a quieter platform serves family attention better than the engagement-driven feed. The phenomenology in plainer prose.',
    intent: 'latent',
    publishedAt: '2026-05-09',
    published: true,
    related: ['what-we-dont-do-at-heretoo', 'on-reading-aloud'],
    body: [
      'Software speeds up. That is what software does. A new app opens in a thousandth of a second. A new feed scrolls forever. A new notification arrives before the last one has settled. Speed reads as competence; speed reads as service. The user gets back what they put in, faster.',
      'The trouble is that family attention runs on a different clock. A grandmother thinks of her grandson on the way to the post office. She remembers the last picture he sent and wonders how he is. She does not need the platform to interrupt that wondering. She needs the platform to be quiet enough that the wondering can happen at all.',
      'Slow software is the deliberate choice to widen the distance between a user and a notification. It is a feed of three posts and then nothing more. It is a daily digest that arrives once and never reminds you again. It is a calm voice reading a letter aloud while you fold laundry, because you might rather hear it than read it. The point of slow software is that it leaves you alone with the people you love, instead of pulling your face back into the glass.',
      'A platform built on slow software gives up something real. It will not have the engagement metrics that make growth charts pleasant. It will not have the daily-active-user counts that fund advertising. It will probably not be the platform a venture firm chooses to back at scale. The trade is on purpose. We are trying to build a place a grandmother actually wants to enter, which means a place that respects how a grandmother actually pays attention.',
      'There is one cheap way to know if you are using slow software. After ten minutes, do you feel a little less anxious, or a little more? The answer is the entire test.',
    ],
  },
  {
    slug: 'what-we-dont-do-at-heretoo',
    title: "What we don't do at HereToo, and why",
    description:
      'A short tour through the things HereToo refuses, and the reasoning. Trust-building through negative space.',
    intent: 'latent',
    publishedAt: '2026-05-09',
    published: true,
    related: ['a-short-defense-of-slow-software', 'how-to-introduce-a-grandparent-to-a-new-app'],
    body: [
      'Most software products are described by what they do. HereToo is also described by what it refuses. The two lists are equally important, and the second one is harder to write.',
      'The family rooms run no advertising. There are no sponsored posts inside the family, no banner placements, no "this experience is brought to you by" interruptions. Those rooms are paid for by a small family subscription, five dollars a month, paid by the family for the family. The grandmother never sees a price; the granddaughter does. A platform that does not sell its families sells its product, and we want to sell the product. The public square — the open part of HereToo where anyone signed in can post pseudonymously — is the explicit exception. It is supported by ads, disclosed when you enter, and the family rooms stay clean.',
      'We do not sell or share user data. Not in aggregate, not anonymized, not for research. The trust a grandmother places in a platform that holds pictures of her grandson is non-fungible. Selling it once destroys it forever. There is no business case worth that.',
      'We do not run public follower counts. Counts produce status anxiety, and status anxiety is the opposite of dwelling. Family is not a popularity contest, and the platform is not a stage. There is no reason for anyone to know how many people you have a connection with.',
      'We do not run streaks. Streaks weaponize loss aversion. The grandmother who closed the app for two weeks should feel welcomed back, not chastised. The teenager who wants to use the app every day will, without a counter scolding them when they miss.',
      'We do not nag. Notifications are reserved for direct messages, queued letters arriving, and updates from a subject the user chose to follow. There is no "your family hasn\'t heard from you in three days." The phrase makes us slightly nauseous. If a person has not posted in three days, that is information for them, not an alarm for us.',
      'We do not show people you may know from outside your family graph. The graph is the privacy boundary. Suggesting a sister-in-law\'s cousin is a real human relationship. Suggesting a stranger because both of you searched for the same restaurant is surveillance.',
      'We do not let bots impersonate real people, living or dead. Shakespeare\'s characters appear in HereToo as a literary chorus. Beatrice and Mercutio are fictional, the line is clear. We do not build "talk to your deceased relative" features. The dignity questions there have not been answered, and we believe they cannot be answered cheaply.',
      'We do not use AI to compose a user\'s posts for them. The Reframer is a narrow exception, opt-in, scoped to escalating direct messages, never visible to the recipient. Beyond that, the user writes their own words. AI-assisted composition flattens voice, and voice is the entire reason a family talks to each other in writing.',
      'We do not collect dates of birth. Age is a vector for ad targeting. Birthdays land in HereToo as rhythms a user enters; the platform has no business knowing the year you were born.',
      'We do not run paid placements in the parlor essays. This essay was not sponsored. The next one will not be sponsored. If we ever take a sponsorship, the parlor collapses, and the platform loses its credibility for nothing.',
      'A small product survives on the things it refuses. The list above will keep getting longer.',
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
