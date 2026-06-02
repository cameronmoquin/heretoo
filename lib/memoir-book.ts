/**
 * memoir-book — the canonical chapter spine + grouping for a memoir
 * project, shared by the in-app preview and (conceptually) the print
 * pipeline.
 *
 * IMPORTANT: this MIRRORS render-worker/src/assemble.js. The worker is
 * Node and ships in its own container, so the two can't import one
 * module — but they must agree on chapter order, titles, and how
 * responses + photos group into chapters, or the on-screen preview
 * will lie about the printed book. If you change the order or titles
 * here, change them there too (and vice-versa).
 */

import type { MemoirResponse, MemoirAsset } from '../hooks/useMemoir';

// Canonical chapter order. Life-chapters run the chronological spine;
// thematic threads follow. Anything unrecognised lands in "Other
// Stories" at the end so nothing is silently dropped.
export const CHAPTER_ORDER: string[] = [
  'before_me', 'earliest_memories', 'childhood', 'adolescence',
  'young_adulthood', 'coming_into_yourself', 'building_a_life',
  'middle', 'older', 'now', 'photo_specific',
  // threads
  'food', 'money', 'hands', 'body', 'music', 'faith', 'places',
  'work', 'losses', 'people', 'things_you_have_kept',
  'things_you_have_buried', 'what_you_believe_now',
  'what_you_would_tell_younger_self',
];

export const CHAPTER_TITLE: Record<string, string> = {
  before_me: 'Before Me',
  earliest_memories: 'Earliest Memories',
  childhood: 'Childhood',
  adolescence: 'Adolescence',
  young_adulthood: 'Young Adulthood',
  coming_into_yourself: 'Coming Into Yourself',
  building_a_life: 'Building a Life',
  middle: 'The Middle Years',
  older: 'Older',
  now: 'Now',
  photo_specific: 'Photographs',
  food: 'Food',
  money: 'Money',
  hands: 'Hands, and What They Made',
  body: 'The Body',
  music: 'Music and Sound',
  faith: 'Faith',
  places: 'Places Lived',
  work: 'Work and Craft',
  losses: 'Losses',
  people: 'People Who Shaped Me',
  things_you_have_kept: 'Things I Have Kept',
  things_you_have_buried: 'Things I Have Buried',
  what_you_believe_now: 'What I Believe Now',
  what_you_would_tell_younger_self: 'What I Would Tell My Younger Self',
};

/** Chapters a writer can move an *entry* into, in spine order. Excludes
 *  photo_specific (a photos-only chapter) and the "other" catch-all.
 *  Shared by the arrange screen's chapter picker. */
export function chapterChoices(): Array<{ key: string; label: string }> {
  return CHAPTER_ORDER
    .filter((k) => k !== 'photo_specific')
    .map((k) => ({ key: k, label: CHAPTER_TITLE[k] }));
}

/** A single answer as it appears in the book: the prompt's question
 *  (if any) and the writer's final prose split into paragraphs. */
export interface BookEntry {
  id: string;
  question: string | null;
  paragraphs: string[];
  wordCount: number;
}

/** A chapter in the assembled book: its title, the prose entries, and
 *  the photos that land in it (after the prose, matching the worker). */
export interface BookChapter {
  key: string;
  title: string;
  entries: BookEntry[];
  photos: MemoirAsset[];
}

export interface AssembledBook {
  chapters: BookChapter[];
  entryCount: number;
  photoCount: number;
  wordCount: number;
}

/** Split prose into paragraphs the same way the worker's
 *  asParagraphs() does for Markdown: blank-line separated, single
 *  newlines collapsed to spaces. */
function toParagraphs(text: string | null | undefined): string[] {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

function countWords(text: string | null | undefined): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/** Group responses + photos into the ordered chapter spine the printed
 *  book uses. Pure — safe to call on every render. */
export function assembleBook(
  responses: MemoirResponse[] | undefined,
  assets: MemoirAsset[] | undefined,
): AssembledBook {
  const rows = responses ?? [];
  // Only photo kinds land in the book (matches the worker's asset query).
  const photos = (assets ?? []).filter(
    (a) => a.kind === 'photo_digital' || a.kind === 'photo_scan',
  );

  // Group responses by chapter: explicit assignment wins, else the
  // prompt's home chapter, else "other".
  const byChapter = new Map<string, MemoirResponse[]>();
  for (const r of rows) {
    const key = r.chapter_assignment || r.prompt?.chapter_or_thread || 'other';
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key)!.push(r);
  }

  // Group photos by chapter (unplaced photos fall into photo_specific).
  const photosByChapter = new Map<string, MemoirAsset[]>();
  for (const a of photos) {
    const key = a.chapter_assignment || 'photo_specific';
    if (!photosByChapter.has(key)) photosByChapter.set(key, []);
    photosByChapter.get(key)!.push(a);
  }

  // Order chapters per the canonical spine; unknown keys at the end.
  const allKeys = new Set<string>([
    ...byChapter.keys(),
    ...photosByChapter.keys(),
  ]);
  const orderedKeys = [
    ...CHAPTER_ORDER.filter((k) => allKeys.has(k)),
    ...[...allKeys].filter((k) => !CHAPTER_ORDER.includes(k)),
  ];

  let entryCount = 0;
  let photoCount = 0;
  let wordCount = 0;

  const chapters: BookChapter[] = orderedKeys.map((key) => {
    const rawEntries = (byChapter.get(key) || [])
      .slice()
      .sort((a, b) => {
        const ao = a.ordering_hint ?? 0;
        const bo = b.ordering_hint ?? 0;
        if (ao !== bo) return ao - bo;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

    const entries: BookEntry[] = rawEntries.map((r) => {
      const question =
        r.prompt?.primary_question || r.custom_prompt_text || null;
      const paragraphs = toParagraphs(r.final_text);
      const wc = countWords(r.final_text);
      entryCount += 1;
      wordCount += wc;
      return { id: r.id, question, paragraphs, wordCount: wc };
    });

    const chapterPhotos = (photosByChapter.get(key) || [])
      .slice()
      .sort((a, b) => (a.ordering_hint ?? 0) - (b.ordering_hint ?? 0));
    photoCount += chapterPhotos.length;

    return {
      key,
      title: CHAPTER_TITLE[key] || 'Other Stories',
      entries,
      photos: chapterPhotos,
    };
  });

  return { chapters, entryCount, photoCount, wordCount };
}
