#!/usr/bin/env node
/**
 * Art reservoir ingestion.
 *
 * Pulls public-domain artworks from open museum APIs and inserts them
 * into `art_works`. Stores image URLs as the source URL — no rehosting,
 * no scraping. (Each museum's terms allow direct hot-linking for
 * non-commercial display of public-domain works.)
 *
 * Sources:
 *   - met    The Metropolitan Museum of Art (CC0)         — no key
 *   - aic    Art Institute of Chicago (CC0)               — no key
 *   - cma    Cleveland Museum of Art (CC0)                — no key
 *   - moma   Museum of Modern Art (research dataset)      — no key
 *   - rijks  Rijksmuseum (CC-BY where applicable)         — needs RIJKS_API_KEY
 *
 * Note on RISD: the RISD Museum does not expose a public collection
 * API. We chose not to scrape their HTML site.
 *
 * Usage:
 *   node scripts/ingest-art.mjs --source met --count 1000
 *   node scripts/ingest-art.mjs --source cma --count all
 *   node scripts/ingest-art.mjs --source all --count 1000
 *
 * `--count all` (or any non-numeric / very large number) means: pull
 * as much as the source will give before stopping. Safe to leave
 * running for hours; the (source, source_id) UNIQUE constraint makes
 * re-runs idempotent — already-ingested rows are silently skipped.
 *
 * Env vars required:
 *   SUPABASE_URL                  (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY     (server-only — bypasses RLS for inserts)
 *   RIJKS_API_KEY                 (only if --source rijks or all)
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
const rawCount = argMap.count ?? '20';
const count = rawCount === 'all' ? Number.MAX_SAFE_INTEGER : (parseInt(rawCount, 10) || 20);

const stats = { inserted: 0, skipped: 0, failed: 0 };

// Don't crash the whole multi-hour ingest on a transient network blip.
// Long-running fetches over flaky residential WiFi otherwise die from
// ECONNRESET / ENOTFOUND / UND_ERR_CONNECT_TIMEOUT and lose their
// progress. We log and keep going.
process.on('uncaughtException', (err) => {
  console.warn('  uncaught:', err?.code ?? err?.message ?? err);
});
process.on('unhandledRejection', (err) => {
  console.warn('  unhandled rejection:', err?.code ?? err?.message ?? err);
});

/**
 * Resilient fetch — wraps the global fetch() with a retry loop so a
 * single dropped connection doesn't end the run. Backs off
 * exponentially up to ~30 seconds and gives up after 8 tries.
 */
async function fetchWithRetry(url, init, attempts = 8) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(url, init);
      return r;
    } catch (e) {
      lastErr = e;
      const wait = Math.min(30_000, 500 * Math.pow(2, i)); // 0.5s ... 30s cap
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── helpers ──────────────────────────────────────────────────────────────
async function upsertWork(row) {
  const r = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/art_works`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (r.ok) {
    stats.inserted++;
    return 'inserted';
  }
  // Duplicate-key from a retry / overlap is fine — silently skip.
  const text = await r.text();
  if (/duplicate key|23505/i.test(text)) {
    stats.skipped++;
    return 'skipped';
  }
  stats.failed++;
  console.warn(`  failed [${row.source_id}]:`, text.slice(0, 120));
  return 'failed';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tickLog(label, n, total) {
  if (n % 25 === 0 || n === total) {
    process.stdout.write(`  ${label} ${n}/${total === Number.MAX_SAFE_INTEGER ? '∞' : total} (ins=${stats.inserted} skip=${stats.skipped} fail=${stats.failed})\n`);
  }
}

// ── Met Museum (open access; CC0) ────────────────────────────────────────
async function ingestMet(target) {
  console.log('── Met Museum (CC0) ──');
  // The Met's `/objects` endpoint returns ALL object IDs (~470k).
  // We walk them in order and skip silently on duplicate-key. This
  // makes long runs fully resumable.
  let ids = [];
  while (ids.length === 0) {
    try {
      const r = await fetchWithRetry('https://collectionapi.metmuseum.org/public/collection/v1/objects');
      const j = await r.json();
      ids = j.objectIDs ?? [];
      if (ids.length === 0) {
        console.warn('  empty Met catalog — retrying in 30s');
        await sleep(30_000);
      }
    } catch (e) {
      console.warn('  Met catalog fetch failed, retrying in 30s:', e?.code ?? e?.message);
      await sleep(30_000);
    }
  }
  // Light shuffle so multiple runs cover different parts of the catalog.
  ids.sort(() => Math.random() - 0.5);

  let processed = 0;
  for (const id of ids) {
    if (stats.inserted >= target) break;
    processed++;
    try {
      const dr = await fetchWithRetry(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
      );
      if (!dr.ok) continue;
      const d = await dr.json();
      if (!d.isPublicDomain || !d.primaryImage) continue;

      await upsertWork({
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
      tickLog('Met', processed, target);

      // Met asks ~1 req/sec; we batch via objectIDs but the per-object
      // fetch above is the rate-limited path. Light pacing.
      await sleep(120);
    } catch {
      stats.failed++;
    }
  }
  console.log(`Met: ${stats.inserted} inserted, ${stats.skipped} skipped`);
}

// ── Art Institute of Chicago (CC0) ───────────────────────────────────────
async function ingestAic(target) {
  console.log('── Art Institute of Chicago (CC0) ──');
  let page = 1;
  while (stats.inserted < target && page <= 1500) {
    let rows = [];
    try {
      const r = await fetchWithRetry(
        `https://api.artic.edu/api/v1/artworks?limit=100&fields=id,title,artist_display,date_display,classification_titles,style_titles,medium_display,image_id,is_public_domain&page=${page}`,
      );
      const j = await r.json();
      rows = j.data ?? [];
    } catch (e) {
      console.warn(`  AIC page ${page} fetch failed, sleeping 30s and continuing:`, e?.code ?? e?.message);
      await sleep(30_000);
      continue;            // retry the same page
    }
    if (rows.length === 0) break;
    for (const a of rows) {
      if (stats.inserted >= target) break;
      if (!a.is_public_domain || !a.image_id) continue;
      const url = `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`;
      const thumb = `https://www.artic.edu/iiif/2/${a.image_id}/full/200,/0/default.jpg`;
      await upsertWork({
        source: 'aic',
        source_id: String(a.id),
        title: a.title ?? null,
        artist: a.artist_display || null,
        year_created: a.date_display || null,
        genre: a.classification_titles ?? null,
        school: (a.style_titles ?? [])[0] ?? null,
        medium: a.medium_display || null,
        storage_path: url,
        thumb_path: thumb,
        license: 'CC0',
        source_url: `https://www.artic.edu/artworks/${a.id}`,
      });
    }
    tickLog('AIC page', page, '∞');
    page++;
  }
  console.log(`AIC: ${stats.inserted} inserted, ${stats.skipped} skipped`);
}

// ── Cleveland Museum of Art (CC0) ────────────────────────────────────────
async function ingestCma(target) {
  console.log('── Cleveland Museum of Art (CC0) ──');
  let skip = 0;
  const PAGE = 100;
  while (stats.inserted < target && skip < 100000) {
    let rows = [];
    try {
      const r = await fetchWithRetry(
        `https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=${PAGE}&skip=${skip}`,
      );
      const j = await r.json();
      rows = j?.data ?? [];
    } catch (e) {
      console.warn(`  CMA skip=${skip} fetch failed, sleeping 30s:`, e?.code ?? e?.message);
      await sleep(30_000);
      continue;             // retry the same skip offset
    }
    if (rows.length === 0) break;
    for (const a of rows) {
      if (stats.inserted >= target) break;
      const img = a?.images?.web?.url ?? a?.images?.print?.url;
      if (!img) continue;
      const thumb = a?.images?.web?.url ?? null;
      const artistName = (a?.creators ?? [])[0]?.description?.split('(')[0]?.trim() ?? null;
      await upsertWork({
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
    }
    tickLog('CMA skip', skip + PAGE, '∞');
    skip += PAGE;
  }
  console.log(`CMA: ${stats.inserted} inserted, ${stats.skipped} skipped`);
}

// ── Museum of Modern Art (research dataset on GitHub) ────────────────────
//
// MoMA publishes their full Artworks dataset as JSON on GitHub. They
// don't host an image CDN with stable URLs for all works, but a subset
// have ThumbnailURL / OnView fields. We pull the JSON once, filter to
// rows that have a usable image URL, then upsert.
async function ingestMoma(target) {
  console.log('── Museum of Modern Art (research dataset) ──');
  const url = 'https://media.githubusercontent.com/media/MuseumofModernArt/collection/main/Artworks.json';
  const r = await fetchWithRetry(url);
  if (!r.ok) {
    console.warn('MoMA dataset fetch failed:', r.status);
    return;
  }
  const all = await r.json();
  // Shuffle so different runs cover different slices of ~140k rows.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  let processed = 0;
  for (const a of all) {
    if (stats.inserted >= target) break;
    processed++;
    const img = a.ThumbnailURL || a.URL; // ThumbnailURL is the most reliable image field
    if (!img || !/^https?:/.test(img)) continue;
    if (!/(\.jpg|\.jpeg|\.png|\.gif|\.webp)/i.test(img) && !img.includes('moma.org')) continue;
    await upsertWork({
      source: 'moma',
      source_id: String(a.ObjectID ?? a.AccessionNumber),
      title: a.Title ?? null,
      artist: Array.isArray(a.Artist) ? a.Artist.join(', ') : (a.Artist ?? null),
      year_created: a.Date ?? null,
      genre: a.Classification ? [String(a.Classification)] : null,
      school: a.Nationality?.[0] ?? null,
      medium: a.Medium ?? null,
      storage_path: img,
      thumb_path: a.ThumbnailURL ?? null,
      license: 'unknown',
      source_url: a.URL ?? null,
      description: a.Dimensions ?? null,
    });
    if (processed % 100 === 0) tickLog('MoMA', processed, target);
  }
  console.log(`MoMA: ${stats.inserted} inserted, ${stats.skipped} skipped`);
}

// ── Rijksmuseum (CC-BY where applicable; needs API key) ─────────────────
async function ingestRijks(target) {
  console.log('── Rijksmuseum ──');
  const key = process.env.RIJKS_API_KEY;
  if (!key) {
    console.warn('Set RIJKS_API_KEY in .env to ingest from Rijksmuseum (free at rijksmuseum.nl/en/api).');
    return;
  }
  let page = 1;
  while (stats.inserted < target && page <= 100) {
    const r = await fetchWithRetry(
      `https://www.rijksmuseum.nl/api/en/collection?key=${key}&format=json&imgonly=true&ps=100&p=${page}`,
    );
    const j = await r.json();
    const rows = j.artObjects ?? [];
    if (rows.length === 0) break;
    for (const a of rows) {
      if (stats.inserted >= target) break;
      const url = a.webImage?.url;
      if (!url) continue;
      await upsertWork({
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
    }
    tickLog('Rijks page', page, '∞');
    page++;
  }
  console.log(`Rijks: ${stats.inserted} inserted, ${stats.skipped} skipped`);
}

// ── dispatch ─────────────────────────────────────────────────────────────
const sources = {
  met: ingestMet,
  aic: ingestAic,
  cma: ingestCma,
  moma: ingestMoma,
  rijks: ingestRijks,
  all: async (n) => {
    await ingestCma(n);
    await ingestAic(n);
    await ingestMet(n);
    await ingestMoma(n);
    await ingestRijks(n);
  },
};

const fn = sources[source];
if (!fn) {
  console.error(`Unknown source "${source}". Use one of: ${Object.keys(sources).join(', ')}`);
  process.exit(1);
}

// Outer retry: even after the per-loop try/catches, a sustained DNS
// outage or other surprise can throw past the inner handlers. Wrap
// the whole run so the script bounces right back instead of exiting.
const KEEPALIVE = setInterval(() => {}, 60_000); // hold the event loop open
let attempts = 0;
while (attempts < 50) {
  attempts++;
  try {
    await fn(count);
    break;                                   // clean finish
  } catch (e) {
    console.warn(`  outer loop error (attempt ${attempts}), sleeping 60s:`, e?.code ?? e?.message);
    await sleep(60_000);
  }
}
clearInterval(KEEPALIVE);
console.log(`Done. inserted=${stats.inserted} skipped=${stats.skipped} failed=${stats.failed}`);
