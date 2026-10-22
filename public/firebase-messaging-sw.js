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

// Handle background messages via Firebase SDK
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Received background message:", payload);

  const notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "BlackHousse";

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Nouvelle mise à jour de commande.",
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
    tag: payload.data?.tag || payload.data?.reference || "blackhousse-order",
    renotify: true,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Native push event listener as robust fallback
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const rawData = event.data.json();
    const notification = rawData.notification || {};
    const data = rawData.data || {};

    const title = notification.title || data.title || "BlackHousse";
    const options = {
      body: notification.body || data.body || "",
      icon: notification.icon || data.icon || "/icons/icon-192x192.png",
      badge: notification.badge || data.badge || "/icons/icon-72x72.png",
      vibrate: [200, 100, 200],
      data: {
        url: rawData.fcmOptions?.link || data.url || data.click_action || "/",
        ...data,
      },
      tag: data.tag || data.reference || "blackhousse-order",
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // If not json, display raw text
    event.waitUntil(
      self.registration.showNotification("BlackHousse", {
        body: event.data.text(),
        icon: "/icons/icon-192x192.png",
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

