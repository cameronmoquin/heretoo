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

// v132 refreshes the offline shell on every successful load and prunes
// superseded bundles. The bump is not cosmetic: activate() deletes every
// cache that does not start with VERSION, which is what evicts the stale
// v131 shell and the old bundles it pointed at from devices already stuck
// on them. Bumping is also what makes browsers install a new worker
// rather than keeping the cached one.
const VERSION = 'heretoo-v132';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSETS_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;

// The one key the offline fallback is stored under. Every navigation in a
// SPA returns the same document, so there is exactly one shell.
const SHELL_KEY = '/index.html';

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

/**
 * Drop entry bundles the live HTML no longer references.
 *
 * Two reasons. The bundle is ~3.8MB and assets are cache-first and never
 * evicted within a VERSION, so every deploy left another copy behind
 * forever — and an origin that blows its storage budget gets its whole
 * quota reclaimed by the browser, taking the working cache with it.
 * Second, a superseded bundle sitting in the cache is exactly what let a
 * stale shell boot an old app. Nothing references it; nothing should keep
 * it.
 *
 * Only entry-*.js is touched. Fonts, images and CSS are left alone.
 */
async function pruneSupersededBundles(html) {
  const m = /\/_expo\/static\/js\/web\/(entry-[a-f0-9]+\.js)/.exec(html || '');
  if (!m) return;
  const current = m[1];
  const cache = await caches.open(ASSETS_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.map((request) => {
    const name = new URL(request.url).pathname.split('/').pop() || '';
    if (/^entry-[a-f0-9]+\.js$/.test(name) && name !== current) {
      return cache.delete(request);
    }
    return undefined;
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never cache writes
  if (req.method !== 'GET') return;

  if (isHtml(req)) {
    // Network-first, and the fallback is kept in step with the network.
    //
    // The previous version fell back to an index.html precached at INSTALL
    // time and never refreshed. That copy pins the device to whatever
    // bundle was live the day the worker installed — a hash that is
    // cache-first below and may no longer exist on the CDN at all. One
    // failed fetch on a flaky connection was enough to boot a months-old
    // app that looked completely normal and stayed that way, because
    // nothing in the loop ever advanced the shell. The stale-HTML trap the
    // old comment warned about was still here, just one step quieter.
    //
    // Now every successful load rewrites the fallback, so the worst the
    // offline path can serve is the last HTML this device actually saw,
    // whose bundle is by construction the one sitting in ASSETS_CACHE.
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const forCache = res.clone();
          const forParse = res.clone();
          event.waitUntil((async () => {
            try {
              const cache = await caches.open(SHELL_CACHE);
              await cache.put(SHELL_KEY, forCache);
              await pruneSupersededBundles(await forParse.text());
            } catch {
              // A cache write failing must never fail the navigation.
            }
          })());
        }
        return res;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(SHELL_KEY)) ?? Response.error();
      }
    })());
    return;
  }

  if (isAsset(req)) {
    event.respondWith((async () => {
      // Scoped to this version's cache. A bare caches.match() searches
      // every cache on the origin, so a leftover from an older VERSION
      // could still be served ahead of the network.
      const cache = await caches.open(ASSETS_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      // Only store what actually came back. Caching a 404 for a bundle
      // the CDN has dropped would make that failure permanent, and
      // fingerprinted URLs never retry under a different name.
      if (res && res.ok) {
        const copy = res.clone();
        event.waitUntil(cache.put(req, copy).catch(() => {}));
      }
      return res;
    })());
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

/**
 * Push.
 *
 * The payload is deliberately thin — who wrote and which thread — and never
 * the message body. A push notification renders on a lock screen anyone can
 * see, and this app's argument is that what people write here is theirs. The
 * email path (netlify/functions/message-email.ts) withholds the body for the
 * same reason.
 *
 * Sent from netlify/functions/push-send.ts, which fires the moment a message
 * is written rather than on the email poller's two-minute cycle.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload should still buzz rather than vanish silently.
    data = {};
  }

  const title = data.title || 'HereToo';
  const options = {
    body: data.body || 'You have a message.',
    // Reusing the maskable PWA icon; no separate asset to keep in sync.
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // iOS ignores this, Android honours it. Harmless where unsupported.
    vibrate: [0, 250, 250, 250],
    // Collapse repeats from one thread instead of stacking a screenful.
    tag: data.tag || 'heretoo-message',
    renotify: true,
    data: { url: data.url || '/messages' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Tapping the notification focuses an open tab rather than opening a second
 * one, then routes it to the thread.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/messages';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
      }),
  );
});
