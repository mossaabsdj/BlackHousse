/**
 * BlackHousse Progressive Web App Service Worker
 * 
 * Secure caching policy:
 * - NEVER caches API calls (/api/*), auth (/Login, NextAuth), or admin (/Admin)
 * - Cache-first for immutable static assets (/_next/static/*, /icons/*, /images/*)
 * - Network-first for navigation requests with custom /offline fallback
 */

const CACHE_VERSION = "bh-pwa-v1";
const STATIC_CACHE = `blackhousse-static-${CACHE_VERSION}`;
const ASSET_CACHE = `blackhousse-assets-${CACHE_VERSION}`;

// Pre-cached critical assets for install and offline display
const PRECACHE_ASSETS = [
  "/offline",
  "/favicon.ico",
  "/manifest.json",
  "/images/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

// URLs that must NEVER be cached by the service worker
function isNonCacheable(url) {
  const path = url.pathname;
  return (
    path.startsWith("/api/") ||
    path.startsWith("/Admin") ||
    path.startsWith("/Login") ||
    path.includes("next-auth") ||
    path.includes("firebase-messaging-sw.js") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("res.cloudinary.com") ||
    url.hostname.includes("cloudinary.com") ||
    url.searchParams.has("code") ||
    url.searchParams.has("token")
  );
}

// Check if request is for static assets (scripts, styles, fonts, images)
function isStaticAsset(url) {
  const path = url.pathname;
  return (
    path.startsWith("/_next/static/") ||
    path.startsWith("/icons/") ||
    path.startsWith("/images/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff|woff2|ttf|css|js)$/i.test(path)
  );
}

/* -------------------------------------------------------------------------- */
/*                                INSTALL                                     */
/* -------------------------------------------------------------------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(async (cache) => {
        try {
          await cache.addAll(PRECACHE_ASSETS);
        } catch (err) {
          console.warn("[PWA SW] Non-fatal precache error:", err);
        }
      })
      .then(() => self.skipWaiting())
  );
});

/* -------------------------------------------------------------------------- */
/*                                ACTIVATE                                    */
/* -------------------------------------------------------------------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

/* -------------------------------------------------------------------------- */
/*                                 FETCH                                      */
/* -------------------------------------------------------------------------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // 2. Only handle HTTP/HTTPS (ignore chrome-extension, devtools, etc.)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // 3. Security check: NEVER cache API, authentication, admin, or Firebase requests
  if (isNonCacheable(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // 4. HTML Navigation requests (Page loads)
  // Strategy: Network-First with Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          // If offline or network fails, serve the branded offline page
          const cache = await caches.open(STATIC_CACHE);
          const cachedOffline = await cache.match("/offline");
          if (cachedOffline) {
            return cachedOffline;
          }
          return new Response(
            "<html><body><h1>Hors connexion</h1><p>Vérifiez votre connexion internet.</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // 5. Static immutable assets (_next/static, icons, images, fonts)
  // Strategy: Cache-First with Network fallback and dynamic caching
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            // Only cache valid basic responses
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              const clone = networkResponse.clone();
              caches.open(ASSET_CACHE).then((cache) => {
                cache.put(request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // If asset request fails offline, return placeholder if available
            return null;
          });
      })
    );
    return;
  }

  // 6. Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});



