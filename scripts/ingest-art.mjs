#!/usr/bin/env node
/**
 * Art reservoir ingestion.
 *
 * Pulls public-domain artworks from open museum APIs and inserts them
 * into `art_works`. Stores image URLs as the source URL — no rehosting,
 * no scraping. (Each museum's terms allow direct hot-linking for
 * non-commercial display of public-domain works.)
 *
 * Usage:
 *   node scripts/ingest-art.mjs --source met --count 50
 *   node scripts/ingest-art.mjs --source rijks --count 50
 *   node scripts/ingest-art.mjs --source aic --count 50
 *
 * Env vars required:
 *   SUPABASE_URL                  (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY     (server-only — bypasses RLS for inserts)
 *   RIJKS_API_KEY                 (only if --source rijks)
 *
 * The script is idempotent: a `(source, source_id)` UNIQUE constraint
 * means re-running just upserts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── env loading ──────────────────────────────────────────────────────────
function loadDotEnv() {
  const path = join(process.cwd(), '.env');
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadDotEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.');
  process.exit(1);
}

// ── arg parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = Object.fromEntries(
  args.map((a, i) => (a.startsWith('--') ? [a.slice(2), args[i + 1]] : null)).filter(Boolean),
);
const source = argMap.source ?? 'met';
const count = parseInt(argMap.count ?? '20', 10);

// ── helpers ──────────────────────────────────────────────────────────────
async function upsertWork(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/art_works`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) {
    console.warn(`  failed [${row.source_id}]:`, await r.text());
    return false;
  }
  return true;
}

// ── Met Museum (open access; CC0) ───────────────────────────────────────
async function ingestMet(count) {
  console.log('── Met Museum (CC0) ──');
  // The Met has no built-in random-sample API, so we hit their search
  // for a broad term and walk results.
  const r = await fetch(
    'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=portrait',
  );
  const j = await r.json();
  const ids = (j.objectIDs ?? []).slice(0, count * 3); // overshoot, some won't have images
  let inserted = 0;
  for (const id of ids) {
    if (inserted >= count) break;
    try {
      const dr = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
      );
      const d = await dr.json();
      if (!d.isPublicDomain || !d.primaryImage) continue;
      const ok = await upsertWork({
        source: 'met',
        source_id: String(d.objectID),
        title: d.title ?? null,
        artist: d.artistDisplayName || null,
        year_created: d.objectDate || null,
        genre: [d.classification, d.medium].filter(Boolean),
        school: d.culture || null,
        medium: d.medium || null,
        storage_path: d.primaryImage,
        thumb_path: d.primaryImageSmall || null,
        license: 'CC0',
        source_url: d.objectURL ?? null,
        description: d.creditLine ?? null,
      });
      if (ok) {
        inserted++;
        process.stdout.write(`  [${inserted}/${count}] ${(d.title ?? '').slice(0, 60)}\n`);
      }
    } catch (e) {
      // swallow per-record failures; Met API rate-limits aren't our enemy here
    }
  }
  console.log(`Met: inserted ${inserted}`);
}

// ── Art Institute of Chicago (open access; CC0) ─────────────────────────
async function ingestAic(count) {
  console.log('── Art Institute of Chicago (CC0) ──');
  let inserted = 0;
  let page = 1;
  while (inserted < count && page <= 5) {
    const r = await fetch(
      `https://api.artic.edu/api/v1/artworks?limit=100&fields=id,title,artist_display,date_display,classification_titles,style_titles,image_id,is_public_domain&page=${page}`,
    );
    const j = await r.json();
    for (const a of j.data ?? []) {
      if (inserted >= count) break;
      if (!a.is_public_domain || !a.image_id) continue;
      const url = `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`;
      const thumb = `https://www.artic.edu/iiif/2/${a.image_id}/full/200,/0/default.jpg`;
      const ok = await upsertWork({
        source: 'aic',
        source_id: String(a.id),
        title: a.title ?? null,
        artist: a.artist_display || null,
        year_created: a.date_display || null,
        genre: a.classification_titles ?? null,
        school: (a.style_titles ?? [])[0] ?? null,
        storage_path: url,
        thumb_path: thumb,
        license: 'CC0',
        source_url: `https://www.artic.edu/artworks/${a.id}`,
      });
      if (ok) {
        inserted++;
        process.stdout.write(`  [${inserted}/${count}] ${(a.title ?? '').slice(0, 60)}\n`);
      }
    }
    page++;
  }
  console.log(`AIC: inserted ${inserted}`);
}

// ── Rijksmuseum (CC-BY where applicable; needs API key) ─────────────────
async function ingestRijks(count) {
  console.log('── Rijksmuseum ──');
  const key = process.env.RIJKS_API_KEY;
  if (!key) {
    console.warn('Set RIJKS_API_KEY in .env to ingest from Rijksmuseum (free at rijksmuseum.nl/en/api).');
    return;
  }
  let inserted = 0;
  let page = 1;
  while (inserted < count && page <= 5) {
    const r = await fetch(
      `https://www.rijksmuseum.nl/api/en/collection?key=${key}&format=json&imgonly=true&ps=100&p=${page}&toppieces=true`,
    );
    const j = await r.json();
    for (const a of j.artObjects ?? []) {
      if (inserted >= count) break;
      const url = a.webImage?.url;
      if (!url) continue;
      const ok = await upsertWork({
        source: 'rijks',
        source_id: a.objectNumber,
        title: a.title ?? null,
        artist: a.principalOrFirstMaker ?? null,
        year_created: null,
        storage_path: url,
        thumb_path: a.headerImage?.url ?? null,
        license: 'CC-BY',
        source_url: a.links?.web ?? null,
        description: a.longTitle ?? null,
      });
      if (ok) {
        inserted++;
        process.stdout.write(`  [${inserted}/${count}] ${(a.title ?? '').slice(0, 60)}\n`);
      }
    }
    page++;
  }
  console.log(`Rijks: inserted ${inserted}`);
}

// ── Cleveland Museum of Art (CC0; no key needed) ───────────────────────
//
// We attempted to add RISD here but they don't expose a public API
// (Drupal site, search-only HTML). CMA has a great open-access REST
// endpoint: 41k+ CC0 works, full metadata, no auth.
async function ingestCma(count) {
  console.log('── Cleveland Museum of Art (CC0) ──');
  let inserted = 0;
  let skip = 0;
  const PAGE = 100;
  while (inserted < count && skip < 5000) {
    const r = await fetch(
      `https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=${PAGE}&skip=${skip}`,
    );
    const j = await r.json();
    const rows = j?.data ?? [];
    if (rows.length === 0) break;
    for (const a of rows) {
      if (inserted >= count) break;
      const img = a?.images?.web?.url ?? a?.images?.print?.url;
      if (!img) continue;
      const thumb = a?.images?.web?.url ?? null;
      const artistName = (a?.creators ?? [])[0]?.description?.split('(')[0]?.trim() ?? null;
      const ok = await upsertWork({
        source: 'cma',
        source_id: String(a.id),
        title: a.title ?? null,
        artist: artistName,
        year_created: a.creation_date || null,
        genre: a.technique ? [a.technique] : null,
        school: a.culture?.[0] ?? null,
        medium: a.technique || null,
        storage_path: img,
        thumb_path: thumb,
        license: 'CC0',
        source_url: a.url ?? null,
        description: a.description ?? a.tombstone ?? null,
      });
      if (ok) {
        inserted++;
        process.stdout.write(`  [${inserted}/${count}] ${(a.title ?? '').slice(0, 60)}\n`);
      }
    }
    skip += PAGE;
  }
  console.log(`CMA: inserted ${inserted}`);
}

// ── dispatch ─────────────────────────────────────────────────────────────
const sources = {
  met: ingestMet,
  aic: ingestAic,
  rijks: ingestRijks,
  cma: ingestCma,
  all: async (n) => {
    await ingestCma(n);
    await ingestMet(n);
    await ingestAic(n);
    await ingestRijks(n);
  },
};

const fn = sources[source];
if (!fn) {
  console.error(`Unknown source "${source}". Use one of: ${Object.keys(sources).join(', ')}`);
  process.exit(1);
}

await fn(count);
console.log('Done.');
