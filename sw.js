/* Kinky Glam Trainer - Service Worker (GitHub Pages friendly) */

const CACHE_VERSION = "kgt-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./tasks.csv",
  "./goals.csv",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: Cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: Cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - For navigation (HTML): network-first (so updates come through), fallback to cache
// - For everything else: cache-first, fallback to network
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // HTML / navigation: network-first
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Others: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
