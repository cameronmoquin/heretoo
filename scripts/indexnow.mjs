#!/usr/bin/env node
/**
 * Tell Bing and Yandex the site changed, instead of waiting to be found.
 *
 * WHY THIS EXISTS. heretoo.social ships web.output "single", so the
 * document a crawler receives is a React shell. Discovery has always
 * depended entirely on the two sitemaps, and a sitemap is a passive
 * invitation — the engine reads it when it feels like it, which for a
 * new low-authority domain can be weeks. IndexNow is the push version:
 * an HTTP POST that says "these URLs exist, come and look." Bing,
 * Yandex, Seznam and Naver share one IndexNow pool, so a single
 * submission reaches all of them. Google does not participate; Google
 * is Search Console's job.
 *
 * HOW THE KEY WORKS. Ownership is proved by hosting a file at
 * /<key>.txt whose entire contents are the key. The file must already
 * be live when the submission lands or the API answers 403 — which
 * means a deploy has to finish before this script is any use. Running
 * it against a stale deploy is the one way to get a confusing failure.
 *
 * The key file lives in public/ and is copied to dist/ by the normal
 * build, so it deploys like any other static asset. It is deliberately
 * NOT a secret: it is a public ownership token, the whole point of
 * which is that anyone can fetch it.
 *
 * USAGE
 *   node scripts/indexnow.mjs            submit every URL in both sitemaps
 *   node scripts/indexnow.mjs --dry-run  print what would be sent
 *
 * Run it after a deploy that changed or added pages. It is safe to
 * re-run; resubmitting an unchanged URL is explicitly allowed, though
 * spamming it daily with no changes is the documented way to get
 * throttled.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'heretoo.social';
const ORIGIN = `https://${HOST}`;
const SITEMAPS = [`${ORIGIN}/sitemap.xml`, `${ORIGIN}/fsot/sitemap.xml`];
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const DRY = process.argv.includes('--dry-run');

/** The key is whatever 32-hex .txt file is sitting in public/. One source
 *  of truth: rotating the key means renaming that file, nothing else. */
function findKey() {
  const dir = join(process.cwd(), 'public');
  const hit = readdirSync(dir).find((f) => /^[a-f0-9]{8,128}\.txt$/i.test(f));
  if (!hit) {
    throw new Error(
      'No IndexNow key file in public/. Create public/<key>.txt whose contents are exactly <key>.',
    );
  }
  const key = hit.replace(/\.txt$/i, '');
  const body = readFileSync(join(dir, hit), 'utf8').trim();
  if (body !== key) {
    throw new Error(
      `public/${hit} must contain exactly "${key}" and nothing else; it contains "${body.slice(0, 40)}".`,
    );
  }
  return key;
}

async function urlsFromSitemaps() {
  const out = new Set();
  for (const sm of SITEMAPS) {
    const res = await fetch(sm);
    if (!res.ok) throw new Error(`${sm} returned ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1].trim();
      // The API rejects the whole batch if one URL is off-host, so drop
      // strays here rather than discovering it as a 422.
      if (u.startsWith(ORIGIN)) out.add(u);
    }
  }
  return [...out].sort();
}

const key = findKey();
const urlList = await urlsFromSitemaps();
console.log(`key       ${key}`);
console.log(`keyLocation ${ORIGIN}/${key}.txt`);
console.log(`urls      ${urlList.length}`);

// The key file has to be reachable before the API will trust it. Check
// first: a clear message here beats deciphering a bare 403.
const probe = await fetch(`${ORIGIN}/${key}.txt`);
const probeBody = probe.ok ? (await probe.text()).trim() : '';
if (!probe.ok || probeBody !== key) {
  console.error(
    `\nkey file not live yet: ${ORIGIN}/${key}.txt returned ${probe.status}` +
      (probe.ok ? ` with "${probeBody.slice(0, 40)}"` : '') +
      '\nDeploy first, then re-run. IndexNow answers 403 if it cannot read the key.',
  );
  process.exit(1);
}
console.log('key file   live and matching');

if (DRY) {
  console.log('\n--dry-run, nothing submitted. First five:');
  urlList.slice(0, 5).forEach((u) => console.log('  ' + u));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList }),
});

// 200 accepted, 202 accepted with the key still being validated. Both
// are success; everything else is worth reading aloud.
const EXPLAIN = {
  400: 'bad request — malformed JSON or an invalid URL in the list',
  403: 'key rejected — the key file is not readable at keyLocation',
  422: 'a URL does not belong to this host, or the key does not match',
  429: 'throttled — too many submissions',
};
console.log(`\nPOST ${ENDPOINT} -> ${res.status} ${res.statusText}`);
if (res.status === 200 || res.status === 202) {
  console.log(`Submitted ${urlList.length} URLs to the IndexNow pool (Bing, Yandex, Seznam, Naver).`);
} else {
  console.error(EXPLAIN[res.status] ?? 'unexpected status');
  console.error((await res.text()).slice(0, 400));
  process.exit(1);
}
