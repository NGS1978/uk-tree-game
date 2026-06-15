/* UK Tree Game — service worker (offline caching).  Added v103 (user-directed).
 *
 * The whole app is ONE self-contained HTML file: every photo (base64), the
 * synthesised audio (Web Audio — no files), the fonts (@font-face embedded), the
 * manifest + icons (data: URIs) and all CSS/JS are inline. So there is exactly
 * ONE thing to cache: the HTML document served at ./ (index.html on Pages).
 *
 * Strategy: cache-FIRST. Once the document is cached, launches are instant and
 * fully offline, and — the whole point — the ~11.6 MB file is NOT re-downloaded
 * on every launch. Updates ride the SW lifecycle:
 *
 *   >>> BUMP `VERSION` BELOW ON EVERY PUBLISH (keep it equal to JANS_VERSION in
 *       the HTML). <<<  Cache-first never re-fetches a cached URL, so if VERSION
 *       is NOT bumped the old document is served forever. Bumping it changes
 *       this file's bytes → the browser installs the new SW → it precaches the
 *       fresh document into a new versioned cache → activate deletes the old
 *       cache → skipWaiting + clients.claim() hand control over, so the next
 *       launch serves the new build.
 *
 * Scope: published at /uk-tree-game/sw.js, so its scope is /uk-tree-game/ —
 * exactly the app (migrated from /jans-tree-game/ in v115). Registered HTTPS-only
 * from the HTML, so the file:// copy and the local http preview never touch it.
 */
const VERSION = 125;
const CACHE = 'jtg-v' + VERSION;

self.addEventListener('install', (event) => {
  // Precache the document so the app is offline-ready after one visit. Fetch it
  // network-fresh ({cache:'reload'}) so a just-published build isn't pulled from
  // the HTTP disk cache during a version-bump install. A precache miss (e.g.
  // first-ever visit offline) must not block activation.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(new Request('./', { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Drop every cache that isn't the current version, then take control.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never intercept writes
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;  // let cross-origin pass through
  // Cache-first: serve the cached copy with NO network when present (this is
  // what stops the per-launch 11.6 MB re-download); otherwise fetch, cache a
  // clean same-origin response, and fall back to the cached document offline.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./'));
    })
  );
});
