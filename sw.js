// GRANULA service worker — offline app shell
// index.html: network-first (updates arrive right away), offline — from cache.
// Everything else: cache-first.
const CACHE = "granula-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./cloud.js",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./dmmono-300.woff2",
  "./dmmono-400.woff2",
  "./dmmono-500.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === location.origin;

  // config.js — network first, so freshly added Supabase keys are never served stale
  if (req.mode === "navigate" || /\/config\.js(\?|$)/.test(req.url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
    );
    return;
  }

  // assets — cache first
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
