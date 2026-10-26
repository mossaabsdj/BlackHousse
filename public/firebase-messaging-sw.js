/**
 * Firebase Cloud Messaging & PWA Service Worker for BlackHousse
 * Handles caching, offline support, and background push notifications.
 */

/* eslint-disable no-undef */
// Import core PWA caching and offline handler
try {
  importScripts("/sw.js");
} catch (err) {
  console.warn("[firebase-messaging-sw] /sw.js could not be loaded:", err);
}

// Import Firebase compat libraries
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Initialize Firebase in the service worker
const firebaseConfig = {
  apiKey: "AIzaSyCPiSa-BPlqjwqIJkofsiArpKajMI4JRUE",
  authDomain: "blackhousse-902ef.firebaseapp.com",
  projectId: "blackhousse-902ef",
  storageBucket: "blackhousse-902ef.firebasestorage.app",
  messagingSenderId: "853556578602",
  appId: "1:853556578602:web:c6f93bf1069f514abff653",
  measurementId: "G-QFGHCV0KQ3",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Bounded in-memory deduplication set to prevent displaying the exact same push notification multiple times
const MAX_SW_EVENTS = 500;
const processedSwEvents = new Set();
const swEventQueue = [];

function isDuplicatePush(eventId) {
  if (!eventId) return false;
  if (processedSwEvents.has(eventId)) {
    console.log(`[FCM ServiceWorker] Suppressed duplicate push for eventId: ${eventId}`);
    return true;
  }
  if (swEventQueue.length >= MAX_SW_EVENTS) {
    const oldest = swEventQueue.shift();
    processedSwEvents.delete(oldest);
  }
  processedSwEvents.add(eventId);
  swEventQueue.push(eventId);
  return false;
}

// Helper to detect stored customer locale (from Cache Storage synced by I18nContext, or device navigator)
async function getStoredLocale() {
  try {
    if (typeof caches !== "undefined") {
      const cache = await caches.open("blackhousse-locale");
      const match = await cache.match("/locale");
      if (match) {
        const stored = (await match.text()).trim();
        if (stored) return stored;
      }
    }
  } catch (_) {}

  if (self.navigator?.language?.toLowerCase().startsWith("ar")) {
    return "ar";
  }
  if (self.navigator?.language?.toLowerCase().startsWith("en")) {
    return "en";
  }
  return "fr";
}

// Handle background messages via Firebase SDK (Primary FCM handler)
messaging.onBackgroundMessage(async (payload) => {
  console.log("[FCM ServiceWorker] Received background message payload:", payload);

  const eventId =
    payload.data?.eventId ||
    (payload.data?.reference
      ? `ref_${payload.data.reference}_${payload.data.status || payload.data.type || "update"}`
      : null) ||
    payload.fcmMessageId ||
    payload.messageId;

  if (eventId && isDuplicatePush(eventId)) {
    return;
  }

  const locale = await getStoredLocale();

  let notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "BlackHousse";

  let notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    "Nouvelle mise à jour de commande.";

  // Apply multilingual notification title & body based on user locale
  if (locale === "ar") {
    if (payload.data?.title_ar) notificationTitle = payload.data.title_ar;
    if (payload.data?.body_ar) notificationBody = payload.data.body_ar;
  } else if (locale === "en") {
    if (payload.data?.title_en) notificationTitle = payload.data.title_en;
    if (payload.data?.body_en) notificationBody = payload.data.body_en;
  }

  const tag =
    payload.data?.tag ||
    (payload.data?.reference ? `bh-order-${payload.data.reference}` : "blackhousse-order");

  const notificationOptions = {
    body: notificationBody,
    icon: payload.notification?.icon || payload.data?.icon || "/icons/icon-192x192.png",
    badge: payload.notification?.badge || payload.data?.badge || "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url:
        payload.fcmOptions?.link ||
        payload.data?.url ||
        payload.data?.click_action ||
        "/",
      ...payload.data,
    },
    tag,
    renotify: false, // Prevents repeat sound/vibration alerts when updating existing notification tag
  };

  console.log(`[FCM ServiceWorker] Displaying notification: "${notificationTitle}" (tag: ${tag}, eventId: ${eventId || "none"})`);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Guarded native push event: Only handles non-FCM pushes to prevent duplicate display
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const rawData = event.data.json();

    // FCM payloads (containing from, fcmMessageId, google.c.*, or eventId)
    // are already processed by messaging.onBackgroundMessage. Dropping here prevents dual display.
    const isFcm =
      rawData.from ||
      rawData.fcmMessageId ||
      rawData["google.c.sender.id"] ||
      rawData.fcmOptions ||
      (rawData.data && (rawData.data["google.c.sender.id"] || rawData.data.eventId));

    if (isFcm) {
      return;
    }

    const notification = rawData.notification || {};
    const data = rawData.data || {};
    const eventId = data.eventId || (data.reference ? `raw_${data.reference}` : null);

    if (eventId && isDuplicatePush(eventId)) {
      return;
    }

    const title = notification.title || data.title || "BlackHousse";
    const tag = data.tag || (data.reference ? `bh-order-${data.reference}` : "blackhousse-order");
    const options = {
      body: notification.body || data.body || "",
      icon: notification.icon || data.icon || "/icons/icon-192x192.png",
      badge: notification.badge || data.badge || "/icons/icon-72x72.png",
      vibrate: [200, 100, 200],
      data: {
        url: rawData.fcmOptions?.link || data.url || data.click_action || "/",
        ...data,
      },
      tag,
      renotify: false,
    };

    console.log(`[FCM ServiceWorker] Displaying non-FCM fallback notification: "${title}"`);
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // If payload is plain text and not FCM JSON
    console.log("[FCM ServiceWorker] Displaying text fallback notification");
    event.waitUntil(
      self.registration.showNotification("BlackHousse", {
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
        tag: "blackhousse-text",
        renotify: false,
      })
    );
  }
});

// Click event: Focus existing window or open new window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Look for already open BlackHousse tab
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // If no window is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

