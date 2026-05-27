// Assembles a memoir project into a single Markdown document that
// Pandoc converts to LaTeX. v1 auto-assembles from saved answers:
// responses are grouped into chapters (chronological life-chapters
// first, then thematic threads), each answer rendered under its
// question.

import { supabase } from './supabase.js';

// Canonical chapter order + human titles. Life-chapters run the
// chronological spine; threads follow. Anything unrecognised lands
// in "Other stories" at the end so nothing is silently dropped.
const CHAPTER_ORDER = [
  'before_me', 'earliest_memories', 'childhood', 'adolescence',
  'young_adulthood', 'coming_into_yourself', 'building_a_life',
  'middle', 'older', 'now', 'photo_specific',
  // threads
  'food', 'money', 'hands', 'body', 'music', 'faith', 'places',
  'work', 'losses', 'people', 'things_you_have_kept',
  'things_you_have_buried', 'what_you_believe_now',
  'what_you_would_tell_younger_self',
];

const CHAPTER_TITLE = {
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

// Escape characters that are special in Markdown/LaTeX flow text.
// Pandoc handles LaTeX escaping itself, so here we only need to keep
// Markdown from misinterpreting the user's prose. We deliberately do
// almost nothing: the answers are plain paragraphs, and over-escaping
// would mangle apostrophes and dashes the writer chose.
function asParagraphs(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function fetchProject(projectId) {
  const { data, error } = await supabase
    .from('memoir_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (error) throw new Error(`project fetch: ${error.message}`);
  return data;
}

export async function fetchAuthorName(authorId) {
  if (!authorId) return 'Anonymous';
  const { data } = await supabase
    .from('profiles')
    .select('display_name, full_name, username')
    .eq('id', authorId)
    .maybeSingle();
  return (
    data?.display_name || data?.full_name || data?.username || 'Anonymous'
  );
}

export async function fetchResponses(projectId) {
  const { data, error } = await supabase
    .from('memoir_responses')
    .select(`
      id, final_text, chapter_assignment, ordering_hint, created_at,
      prompt:memoir_prompts!prompt_id(primary_question, chapter_or_thread),
      custom_prompt_text
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`responses fetch: ${error.message}`);
  return data || [];
}

export async function fetchAssets(projectId) {
  const { data, error } = await supabase
    .from('memoir_assets')
    .select('id, kind, storage_path, caption, chapter_assignment, ordering_hint, date_estimate')
    .eq('project_id', projectId)
    .in('kind', ['photo_digital', 'photo_scan']);
  if (error) throw new Error(`assets fetch: ${error.message}`);
  return data || [];
}

/** Local filename used inside the worker's work dir.
 *  Format: photos/{id}.{ext} — matches the markdown refs generated
 *  in buildMarkdown. */
export function assetLocalPath(asset) {
  const ext = (asset.storage_path.split('.').pop() || 'jpg').toLowerCase();
  return `photos/${asset.id}.${ext}`;
}

// Build the full Markdown document (with YAML metadata) for Pandoc.
// Photos are interleaved at the end of their chapter; assets with no
// chapter_assignment fall into 'photo_specific'.
export function buildMarkdown({ project, authorName, responses, assets = [] }) {
  // Group responses by chapter.
  const byChapter = new Map();
  for (const r of responses) {
    const key =
      r.chapter_assignment || r.prompt?.chapter_or_thread || 'other';
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key).push(r);
  }

  // Group assets by chapter (photos w/o a chapter land in photo_specific).
  const assetsByChapter = new Map();
  for (const a of assets) {
    const key = a.chapter_assignment || 'photo_specific';
    if (!assetsByChapter.has(key)) assetsByChapter.set(key, []);
    assetsByChapter.get(key).push(a);
  }

  // Order chapters per the canonical spine; unknown keys at the end.
  const allKeys = new Set([...byChapter.keys(), ...assetsByChapter.keys()]);
  const orderedKeys = [
    ...CHAPTER_ORDER.filter((k) => allKeys.has(k)),
    ...[...allKeys].filter((k) => !CHAPTER_ORDER.includes(k)),
  ];

  const yaml = [
    '---',
    `title: ${yamlString(project.title || 'My Life, So Far')}`,
    `author: ${yamlString(authorName)}`,
    project.dedication
      ? `dedication: ${yamlString(project.dedication)}`
      : null,
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');

  const chapters = orderedKeys.map((key) => {
    const title = CHAPTER_TITLE[key] || 'Other Stories';
    const entries = byChapter.get(key) || [];
    const chapterAssets = (assetsByChapter.get(key) || []).slice().sort((a, b) => {
      const ao = a.ordering_hint ?? 0;
      const bo = b.ordering_hint ?? 0;
      return ao - bo;
    });
    const sortedEntries = entries.slice().sort((a, b) => {
      const ao = a.ordering_hint ?? 0;
      const bo = b.ordering_hint ?? 0;
      if (ao !== bo) return ao - bo;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const proseBody = sortedEntries
      .map((r) => {
        const q = r.prompt?.primary_question || r.custom_prompt_text || '';
        const question = q ? `## ${q}\n\n` : '';
        return `${question}${asParagraphs(r.final_text)}`;
      })
      .join('\n\n');

    // Photos appear after the chapter's prose, each with the writer's
    // caption (sanitised — pandoc treats Markdown special chars in alt
    // text). If there's no prose, the chapter is still rendered so the
    // photographs land somewhere.
    const photoBody = chapterAssets
      .map((a) => {
        const caption = sanitiseAlt(a.caption || '');
        return `![${caption}](${assetLocalPath(a)})${caption ? '' : '{.unnumbered}'}`;
      })
      .join('\n\n');

    const body = [proseBody, photoBody].filter(Boolean).join('\n\n');
    return `# ${title}\n\n${body}`;
  });

  return `${yaml}\n${chapters.join('\n\n')}\n`;
}

function yamlString(s) {
  // Quote and escape for YAML scalar safety.
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function sanitiseAlt(s) {
  // Image alt-text inside Markdown — strip brackets/pipes that would
  // break the link parser; everything else is fine.
  return String(s || '').replace(/[\[\]|]/g, '').trim();
}

export { CHAPTER_TITLE };
