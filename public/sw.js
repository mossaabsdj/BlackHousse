
/**
 * BlackHousse Progressive Web App Service Worker
 *
 * Caching policy:
 * - Never cache API, authentication, admin, Firebase, or Cloudinary requests.
 * - Cache-first for static assets.
 * - Network-first for navigation with an offline fallback.
 */

const CACHE_VERSION = "bh-pwa-v2";
const STATIC_CACHE = `blackhousse-static-${CACHE_VERSION}`;
const ASSET_CACHE = `blackhousse-assets-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/offline",
  "/favicon.ico",
  "/manifest.json",
  "/images/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

function isNonCacheable(url) {
  const path = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  return (
    path.startsWith("/api/") ||
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.includes("next-auth") ||
    path.includes("firebase-messaging-sw.js") ||
    hostname.includes("firestore.googleapis.com") ||
    hostname.includes("firebase") ||
    hostname.includes("cloudinary.com") ||
    url.searchParams.has("code") ||
    url.searchParams.has("token")
  );
}

function isStaticAsset(url) {
  const path = url.pathname;

  return (
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/") ||
    path.startsWith("/images/") ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css|js)$/i.test(path)
  );
}

/* INSTALL */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        // Cache assets individually so one missing file
        // does not prevent the other files from being cached.
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (asset) => {
            const response = await fetch(asset, {
              cache: "reload",
            });

            if (response.ok) {
              await cache.put(asset, response);
            } else {
              console.warn(
                "[PWA SW] Precache failed:",
                asset,
                response.status
              );
            }
          })
        );
      })
      .catch((error) => {
        console.warn("[PWA SW] Installation cache error:", error);
      })
      .then(() => self.skipWaiting())
  );
});

/* ACTIVATE */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("blackhousse-") &&
                key !== STATIC_CACHE &&
                key !== ASSET_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* FETCH */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Never cache sensitive, dynamic, or external service requests.
  if (isNonCacheable(url)) {
    // Do not intercept these requests. Let the browser handle them.
    return;
  }

  // Network-first navigation with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offlinePage = await cache.match("/offline");

        if (offlinePage) {
          return offlinePage;
        }

        return new Response(
          "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Hors connexion</title><body><h1>Hors connexion</h1><p>Vérifiez votre connexion internet.</p></body></html>",
          {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          }
        );
      })
    );

    return;
  }

  // Cache-first for static assets.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);

          if (
            networkResponse &&
            networkResponse.ok &&
            (networkResponse.type === "basic" ||
              networkResponse.type === "cors")
          ) {
            const cache = await caches.open(ASSET_CACHE);

            // Cache a clone without blocking the response.
            event.waitUntil(
              cache.put(request, networkResponse.clone()).catch((error) => {
                console.warn(
                  "[PWA SW] Could not cache asset:",
                  request.url,
                  error
                );
              })
            );
          }

          return networkResponse;
        } catch (error) {
          console.warn(
            "[PWA SW] Static asset fetch failed:",
            request.url,
            error
          );

          // Always return a valid Response, never null.
          return Response.error();
        }
      })()
    );

    return;
  }

  // Default: network-first, with a cached response if available.
  event.respondWith(
    fetch(request).catch(async () => {
      const cachedResponse = await caches.match(request);
      return cachedResponse || Response.error();
    })
  );
});
