/**
 * ingest-babybook — a decade of photos into the timeline, in one run.
 *
 *   node scripts/ingest-babybook.mjs --book <babybook-id> --dir "<folder>"
 *
 * Walks the folder (recursively), dates each photo the same three ways
 * the app would — EXIF DateTimeOriginal, then a date in the filename,
 * then nothing (lands Undated for hand-dating in the app) — uploads to
 * the shared assets bucket, and inserts babybook_assets rows with
 * book_status='pending' so nothing enters the book until it is
 * approved on screen.
 *
 * RESUMABLE. A manifest (.heretoo-ingested.json, written beside the
 * photos) records every file already ingested; re-running skips them,
 * so a dropped connection costs nothing and the archive can be fed in
 * as many sittings as it takes.
 *
 * jpg/jpeg/png/webp/gif only. HEIC is listed at the end rather than
 * silently skipped — convert those and re-run.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const BOOK = argOf('book');
const DIR = argOf('dir');
if (!BOOK || !DIR) {
  console.error('Usage: node scripts/ingest-babybook.mjs --book <babybook-id> --dir "<folder>"');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };

const BUCKET = 'memoir-assets';
const EXT_OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

// ── EXIF DateTimeOriginal, same walk as lib/exifDate.ts ───────────────
function exifDateOf(buf) {
  try {
    const view = new DataView(buf.buffer, buf.byteOffset, Math.min(buf.length, 256 * 1024));
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let offset = 2; let tiff = -1;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda) break;
      const size = view.getUint16(offset + 2);
      if (marker === 0xe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
        tiff = offset + 10; break;
      }
      offset += 2 + size;
    }
    if (tiff < 0 || tiff + 8 > view.byteLength) return null;
    const little = view.getUint16(tiff) === 0x4949;
    const u16 = (o) => view.getUint16(o, little);
    const u32 = (o) => view.getUint32(o, little);
    const ascii = (valOffset, count) => {
      const at = count <= 4 ? valOffset : tiff + u32(valOffset);
      let out = '';
      for (let i = 0; i < count - 1 && at + i < view.byteLength; i++) out += String.fromCharCode(view.getUint8(at + i));
      return out;
    };
    const scan = (ifd, want) => {
      const found = new Map(); let exifIfd = -1;
      if (ifd + 2 > view.byteLength) return { found, exifIfd };
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > view.byteLength) break;
        const tag = u16(e);
        if (tag === 0x8769) exifIfd = tiff + u32(e + 8);
        else if (want.has(tag) && u16(e + 2) === 2) found.set(tag, ascii(e + 8, u32(e + 4)));
      }
      return { found, exifIfd };
    };
    const first = scan(tiff + u32(tiff + 4), new Set([0x0132]));
    let raw = null;
    if (first.exifIfd > 0) {
      const sub = scan(first.exifIfd, new Set([0x9003, 0x9004]));
      raw = sub.found.get(0x9003) ?? sub.found.get(0x9004) ?? null;
    }
    raw = raw ?? first.found.get(0x0132) ?? null;
    const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2})/);
    if (!m || m[1] === '0000') return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
  } catch { return null; }
}

// ── A date hiding in the filename (IMG_20160413, 2016-04-13, PXL_2021…)
function filenameDateOf(name) {
  const m = name.match(/(20[0-2]\d|19\d\d)[-_.]?([01]\d)[-_.]?([0-3]\d)/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const manifestPath = path.join(DIR, '.heretoo-ingested.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : {};
const saveManifest = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

const book = await (await fetch(`${URL_}/rest/v1/babybooks?id=eq.${BOOK}&select=id,author_id,child_name`, { headers: H })).json();
if (!book[0]) { console.error('No such babybook:', BOOK); process.exit(1); }
const AUTHOR = book[0].author_id;
console.log(`Ingesting into "${book[0].child_name}" (${BOOK})`);

let done = 0, skipped = 0, undated = 0, failed = 0;
const heics = [];
const files = [...walk(DIR)].filter((f) => !path.basename(f).startsWith('.'));

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.heic' || ext === '.heif') { heics.push(file); continue; }
  if (!EXT_OK.has(ext)) continue;
  const rel = path.relative(DIR, file);
  if (manifest[rel]) { skipped++; continue; }

  try {
    const buf = fs.readFileSync(file);
    const iso = exifDateOf(buf) ?? filenameDateOf(path.basename(file));
    if (!iso) undated++;

    const storagePath = `${BOOK}/${crypto.randomUUID()}${ext}`;
    const up = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': MIME[ext] },
      body: buf,
    });
    if (!up.ok) throw new Error(`storage ${up.status}: ${(await up.text()).slice(0, 120)}`);

    const ins = await fetch(`${URL_}/rest/v1/babybook_assets`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        babybook_id: BOOK,
        author_id: AUTHOR,
        storage_path: storagePath,
        captured_at: iso,
        captured_precision: iso ? 'day' : null,
        book_status: 'pending',
      }),
    });
    if (!ins.ok) throw new Error(`insert ${ins.status}: ${(await ins.text()).slice(0, 120)}`);

    manifest[rel] = { at: new Date().toISOString(), date: iso ?? 'undated' };
    done++;
    if (done % 25 === 0) { saveManifest(); console.log(`  ${done} in (${undated} undated so far)…`); }
  } catch (e) {
    failed++;
    console.error(`  FAILED ${rel}: ${e.message}`);
  }
}
saveManifest();

console.log(`\nDone. ${done} ingested (${undated} undated → date them in the app), ${skipped} already in from earlier runs, ${failed} failed${failed ? ' — re-run to retry' : ''}.`);
if (heics.length) {
  console.log(`\n${heics.length} HEIC file(s) skipped — convert to JPEG and re-run:`);
  heics.slice(0, 10).forEach((h) => console.log('  ' + path.relative(DIR, h)));
  if (heics.length > 10) console.log(`  …and ${heics.length - 10} more`);
}
console.log('\nEverything landed as PENDING — nothing enters the book until you approve it on screen.');
