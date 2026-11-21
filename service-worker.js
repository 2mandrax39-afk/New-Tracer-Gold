const CACHE_NAME = "new-tracer-gold-offline-v2";

const APP_FILES = [
  "./",
  "./index.html"
];

// INSTALL: Gem appen første gang
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: Ryd kun gamle New Tracer Gold-caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("new-tracer-gold-offline-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH: OFFLINE FIRST
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Kun appens eget domæne
  if (url.origin !== self.location.origin) return;

  // Navigationsforespørgsler
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {

        const cachedPage = await cache.match("./index.html");

        // Hent opdatering fra nettet i baggrunden
        const networkUpdate = fetch(request)
          .then(response => {
            if (response.ok) {
              cache.put("./index.html", response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Brug den gemte side med det samme
        if (cachedPage) {
          event.waitUntil(networkUpdate);
          return cachedPage;
        }

        // Første besøg kræver internet
        const response = await networkUpdate;

        if (response) return response;

        return new Response(
          "New Tracer Gold er endnu ikke gemt offline. Åbn appen med internet først.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      })
    );

    return;
  }

  // Andre filer: cache først
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);

      if (cached) {
        // Opdater cache i baggrunden
        fetch(request)
          .then(response => {
            if (response.ok && response.type === "basic") {
              cache.put(request, response.clone());
            }
          })
          .catch(() => {});

        return cached;
      }

      // Hvis filen ikke findes i cache, hent den
      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }

        return response;

      } catch (error) {
        return new Response("Offline. Filen er ikke gemt lokalt.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })
  );
});