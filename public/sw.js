/**
 * HereToo service worker — minimal offline shell + last-feed cache.
 *
 * Strategies:
 *   - HTML / app shell: network-first, fallback to cached index.html
 *   - JS / CSS bundles (fingerprinted, immutable): cache-first
 *   - PostgREST GETs to Supabase (posts, profiles): stale-while-revalidate,
 *     so the last feed shows up offline while a fresh fetch happens in
 *     the background and updates the cache.
 *
 * Mutating requests (POST/PATCH/DELETE) are NEVER cached and MUST go to
 * the network — otherwise we'd lose writes.
 */

const VERSION = 'heretoo-v35';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSETS_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isApiGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return /\.supabase\.co$/.test(url.hostname) && /\/rest\/v1\//.test(url.pathname);
}

function isAsset(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return false;
  return /\/_expo\/static\//.test(url.pathname)
    || /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname);
}

function isHtml(request) {
  if (request.method !== 'GET') return false;
  return request.mode === 'navigate'
    || request.headers.get('accept')?.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never cache writes
  if (req.method !== 'GET') return;

  if (isHtml(req)) {
    // Network-only for HTML during active development. Caching index.html
    // and falling back to it is the classic PWA cache-trap: cached HTML
    // pins users to a stale fingerprinted-bundle URL that no longer
    // exists on the CDN, breaking the whole app. Refusing the cache
    // means users always see the live HTML pointing to live bundles.
    // We give up offline support for HTML; assets + Supabase GETs are
    // still cached so the feed loads offline once seen.
    event.respondWith(
      fetch(req).catch(async () =>
        (await caches.match('/index.html')) ?? Response.error(),
      ),
    );
    return;
  }

  if (isAsset(req)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached
        ?? fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(ASSETS_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }),
      ),
    );
    return;
  }

  if (isApiGet(req)) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req)
            .then((res) => {
              if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached ?? Response.error());
          // stale-while-revalidate
          return cached ?? fetchPromise;
        }),
      ),
    );
  }
});
