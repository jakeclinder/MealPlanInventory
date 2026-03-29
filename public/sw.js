// Service worker — network-first with cache fallback.
// All same-origin GET requests are cached so the app works fully offline.
const CACHE = "kitchen-hub-v1";

self.addEventListener("install", () => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Delete stale caches from previous versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests for same-origin resources
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      fetch(event.request)
        .then((response) => {
          // Cache a clone of every successful response
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() =>
          // Network failed — serve from cache (offline mode)
          caches.match(event.request)
        )
    )
  );
});
