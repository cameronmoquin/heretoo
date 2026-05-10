/**
 * Scheduled function — pulls headlines from public broadcasting RSS
 * feeds and stores them in news_items.
 *
 * Cadence: every 30 minutes. Each feed yields up to 15 items per
 * pull; older items roll off naturally as published_at < 24h is
 * what the Room hearth + News surface display.
 *
 * Sources (free RSS, no API keys):
 *   - NPR Top Stories  https://feeds.npr.org/1001/rss.xml
 *   - NPR World        https://feeds.npr.org/1004/rss.xml
 *   - BBC World        https://feeds.bbci.co.uk/news/world/rss.xml
 *   - PBS NewsHour     https://www.pbs.org/newshour/feeds/rss/headlines
 *
 * RSS parsing is done by hand here — a small set of regex-based
 * extractions. The feeds we consume have stable, well-formed XML;
 * adding a parser dependency for these four feeds would be overkill.
 */

import type { Config } from '@netlify/functions';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface FeedSource {
  source: 'npr' | 'bbc' | 'pbs' | 'apnews';
  label: string;
  url: string;
  category: 'global' | 'national' | 'arts' | 'science';
}

const FEEDS: FeedSource[] = [
  { source: 'npr', label: 'NPR',          url: 'https://feeds.npr.org/1001/rss.xml',           category: 'national' },
  { source: 'npr', label: 'NPR World',    url: 'https://feeds.npr.org/1004/rss.xml',           category: 'global' },
  { source: 'bbc', label: 'BBC World',    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',  category: 'global' },
  { source: 'pbs', label: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/headlines', category: 'national' },
  { source: 'npr', label: 'NPR Arts',     url: 'https://feeds.npr.org/1008/rss.xml',           category: 'arts' },
  { source: 'npr', label: 'NPR Science',  url: 'https://feeds.npr.org/1007/rss.xml',           category: 'science' },
];

interface ParsedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl?: string;
}

/** Minimal RSS / Atom item parser. Handles the structural variations
 *  in the four feeds we read above without a third-party dependency. */
function parseFeed(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  // Match <item>…</item> blocks (RSS) — covers all four feeds we use.
  const blockRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTagText(block, 'title');
    const link = extractTagText(block, 'link');
    const description = extractTagText(block, 'description');
    const pubDate = extractTagText(block, 'pubDate');
    // Image: BBC uses <media:thumbnail url="..." />; NPR uses
    // <media:content url="..." medium="image" />; PBS sometimes inline.
    let imageUrl: string | undefined;
    const mediaMatch =
      block.match(/<media:thumbnail[^>]*\burl=["']([^"']+)["'][^>]*\/?>/i)
      ?? block.match(/<media:content[^>]*\burl=["']([^"']+)["'][^>]*medium=["']image["'][^>]*\/?>/i)
      ?? block.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*type=["']image[^"']*["'][^>]*\/?>/i);
    if (mediaMatch) imageUrl = mediaMatch[1];
    if (title && link) {
      items.push({
        title: cleanText(title),
        link: link.trim(),
        description: cleanText(description),
        pubDate: pubDate.trim(),
        imageUrl,
      });
    }
  }
  return items;
}

function extractTagText(block: string, tag: string): string {
  // CDATA-wrapped content is common in description/title.
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const cdata = block.match(cdataRe);
  if (cdata) return cdata[1];
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return plain ? plain[1] : '';
}

function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, '')         // strip stray HTML
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summaryFrom(description: string): string {
  if (!description) return '';
  // First two sentences or 280 chars, whichever is shorter.
  const sentences = description.split(/(?<=[.!?])\s+/);
  let acc = '';
  for (const s of sentences) {
    if ((acc + ' ' + s).length > 280) break;
    acc = (acc + ' ' + s).trim();
    if (sentences.indexOf(s) >= 1) break;
  }
  return acc || description.slice(0, 240);
}

/** SHA-256-like fingerprint for de-dup. Plain hash via TextEncoder. */
async function fingerprint(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  // Fallback: djb2-ish hash for environments without subtle.
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return `n-${(h >>> 0).toString(16)}`;
}

export default async () => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response('Missing creds', { status: 500 });
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const feed of FEEDS) {
    let xml = '';
    try {
      const r = await fetch(feed.url, {
        headers: {
          // Some feeds reject empty UA strings.
          'User-Agent': 'HereTooBot/1.0 (https://heretoo.social)',
          accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.5',
        },
      });
      if (!r.ok) { failed += 1; continue; }
      xml = await r.text();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[news] fetch failed', feed.url, e?.message ?? e);
      failed += 1;
      continue;
    }

    const items = parseFeed(xml).slice(0, 15);
    for (const item of items) {
      const fp = await fingerprint(item.link + '|' + item.title);
      const published = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

      const insert = await fetch(`${SUPABASE_URL}/rest/v1/news_items`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify({
          source: feed.source,
          source_label: feed.label,
          category: feed.category,
          headline: item.title.slice(0, 400),
          summary: summaryFrom(item.description),
          url: item.link,
          image_url: item.imageUrl ?? null,
          published_at: published,
          fingerprint: fp,
        }),
      });
      if (insert.ok || insert.status === 409) {
        inserted += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return new Response(
    JSON.stringify({ inserted, skipped, failed, sources: FEEDS.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

/** Every 30 minutes. Public broadcasters publish on their own clock; */
/** 30-min cadence keeps us within an hour of fresh without hammering. */
export const config: Config = {
  schedule: '*/30 * * * *',
};
