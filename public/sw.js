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

// v131 adds the push and notificationclick handlers at the foot of this file.
// Bumping is what makes browsers install the new worker rather than keeping
// the cached one, which would have no push listener at all.
const VERSION = 'heretoo-v131';
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
