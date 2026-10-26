
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

/* -------------------------------------------------------------------------- */
/*                              FIREBASE CONFIG                              */
/* -------------------------------------------------------------------------- */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/* -------------------------------------------------------------------------- */
/*                        BOUNDED EVENT DEDUPLICATION STORE                   */
/* -------------------------------------------------------------------------- */

const MAX_PROCESSED_EVENTS = 1000;
const SESSION_STORAGE_KEY = "bh_processed_events";
const processedEventIds = new Set();
const processedEventQueue = [];

// Initialize from sessionStorage if running in browser
if (typeof window !== "undefined") {
  try {
    const stored = window.sessionStorage?.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === "string" && !processedEventIds.has(id)) {
            processedEventIds.add(id);
            processedEventQueue.push(id);
          }
        }
      }
    }
  } catch (_) {}
}

function persistToSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    const toSave = processedEventQueue.slice(-200);
    window.sessionStorage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(toSave));
  } catch (_) {}
}

/**
 * Checks if an event has already been processed during this session.
 */
export function isEventProcessed(eventId) {
  if (!eventId || typeof eventId !== "string") return false;
  return processedEventIds.has(eventId);
}

/**
 * Records an eventId in the bounded LRU set and persists up to 200 items in sessionStorage.
 */
export function markEventProcessed(eventId) {
  if (!eventId || typeof eventId !== "string") return;
  if (processedEventIds.has(eventId)) return;

  if (processedEventQueue.length >= MAX_PROCESSED_EVENTS) {
    const oldest = processedEventQueue.shift();
    processedEventIds.delete(oldest);
  }

  processedEventIds.add(eventId);
  processedEventQueue.push(eventId);
  persistToSessionStorage();
}

/* -------------------------------------------------------------------------- */
/*                            FIREBASE INITIALIZATION                        */
/* -------------------------------------------------------------------------- */

export function getFirebaseApp() {
  if (typeof window === "undefined") return null;

  try {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    console.error(
      "[firebase] Initialization error:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export function getFirestoreDb() {
  const app = getFirebaseApp();

  if (!app) return null;

  try {
    return getFirestore(app);
  } catch (error) {
    console.error(
      "[firebase] Firestore initialization error:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME ADMIN ORDERS                           */
/* -------------------------------------------------------------------------- */

/**
 * Listens for order creation events and order status changes using discrete event documents.
 *
 * Listens to collection `events` ordered by createdAt descending, limited to 30 events.
 * Uses bounded event deduplication to ensure initial snapshots, React component remounts,
 * reconnections, and Strict Mode do not trigger false new-order sounds or duplicate tickets.
 *
 * Options:
 * onNewOrder(data)
 * onStatusChange(data)
 * onAnyChange(data)
 * onReconnect()
 */
export function useRealtimeAdminOrders({
  onNewOrder,
  onStatusChange,
  onAnyChange,
  onReconnect,
} = {}) {
  const [lastEvent, setLastEvent] = useState(null);
  const [connected, setConnected] = useState(false);

  const callbacksRef = useRef({
    onNewOrder,
    onStatusChange,
    onAnyChange,
    onReconnect,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewOrder,
      onStatusChange,
      onAnyChange,
      onReconnect,
    };
  }, [onNewOrder, onStatusChange, onAnyChange, onReconnect]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const db = getFirestoreDb();
    if (!db) {
      setConnected(false);
      return;
    }

    let isMounted = true;
    let isInitialSnapshot = true;
    let hasHadServerConnection = false;
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let hasServerSnapshot = false;
    let hasError = false;

    const updateConnectionState = () => {
      if (!isMounted) return;
      const isLive = isOnline && hasServerSnapshot && !hasError;
      setConnected(isLive);
      if (isLive) {
        if (!hasHadServerConnection) {
          hasHadServerConnection = true;
        } else {
          // Reconnection after interruption: notify caller to catch up authoritative data silently
          callbacksRef.current.onReconnect?.();
        }
      }
    };

    const handleOnline = () => {
      isOnline = true;
      updateConnectionState();
    };

    const handleOffline = () => {
      isOnline = false;
      hasServerSnapshot = false;
      updateConnectionState();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Query discrete events collection
    const eventsCol = collection(db, "events");
    const eventsQuery = query(eventsCol, orderBy("createdAt", "desc"), limit(30));

    const unsubscribe = onSnapshot(
      eventsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!isMounted) return;

        hasError = false;
        // Verify server-backed synchronization: metadata.fromCache === false confirms server has sent or verified data
        hasServerSnapshot = !snapshot.metadata.fromCache;
        updateConnectionState();

        // 1. Initial snapshot: establish baseline
        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          // Mark all pre-existing events in snapshot as already processed baseline
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const id = data.eventId || docSnap.id;
            // Ignore legacy singletons
            if (["latest_order", "status_change", "latest_feedback", "feedback_status"].includes(id)) {
              return;
            }
            markEventProcessed(id);
          });
          return;
        }

        // 2. Subsequent snapshots / live additions or missed events during offline reconnection
        const docChanges = snapshot.docChanges();
        // Process oldest to newest so sequential changes apply in chronological order
        const addedChanges = docChanges
          .filter((change) => change.type === "added")
          .reverse();

        for (const change of addedChanges) {
          const data = change.doc.data();
          const eventId = data.eventId || change.doc.id;

          // Skip legacy singleton documents
          if (["latest_order", "status_change", "latest_feedback", "feedback_status"].includes(eventId)) {
            continue;
          }

          // Strict deduplication check
          if (isEventProcessed(eventId)) {
            continue;
          }

          markEventProcessed(eventId);
          const payload = data.payload || data;
          setLastEvent(payload);

          if (data.type === "NEW_ORDER") {
            callbacksRef.current.onNewOrder?.(payload);
            callbacksRef.current.onAnyChange?.(payload);
          } else if (data.type === "ORDER_STATUS_CHANGE" || data.type === "STATUS_CHANGE") {
            callbacksRef.current.onStatusChange?.(payload);
            callbacksRef.current.onAnyChange?.(payload);
          }
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error("[firebase] Admin orders events listener error:", error.message);
        hasError = true;
        hasServerSnapshot = false;
        updateConnectionState();
      }
    );

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  return { lastEvent, connected };
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME CUSTOMER ORDER                        */
/* -------------------------------------------------------------------------- */

/**
 * Listens to one order in real time.
 *
 * reference must match the Firestore document ID.
 */
export function useRealtimeOrder(reference) {
  const [liveOrder, setLiveOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(reference));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!reference) {
      setLiveOrder(null);
      setLoading(false);
      setConnected(false);
      return;
    }

    if (typeof window === "undefined") return;

    const db = getFirestoreDb();
    if (!db) {
      setLiveOrder(null);
      setLoading(false);
      setConnected(false);
      return;
    }

    let isMounted = true;
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let hasServerSnapshot = false;
    let hasError = false;

    const updateConnectionState = () => {
      if (!isMounted) return;
      setConnected(isOnline && hasServerSnapshot && !hasError);
    };

    const handleOnline = () => {
      isOnline = true;
      updateConnectionState();
    };

    const handleOffline = () => {
      isOnline = false;
      hasServerSnapshot = false;
      updateConnectionState();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setLoading(true);
    setConnected(false);
    setLiveOrder(null);

    const orderRef = doc(db, "orders", reference);

    const unsubscribe = onSnapshot(
      orderRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!isMounted) return;
        hasError = false;
        hasServerSnapshot = !snapshot.metadata.fromCache;
        updateConnectionState();
        setLoading(false);

        if (snapshot.exists()) {
          setLiveOrder({
            id: snapshot.id,
            ...snapshot.data(),
          });
        } else {
          setLiveOrder(null);
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error("[firebase] Customer order listener:", error.message);
        hasError = true;
        hasServerSnapshot = false;
        updateConnectionState();
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [reference]);

  return { liveOrder, loading, connected };
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME PRODUCTS                               */
/* -------------------------------------------------------------------------- */

/**
 * Listens to product changes in real time.
 *
 * Callback:
 * onProductChange(id, data)
 */
export function useRealtimeProducts(onProductChange) {
  const [productMap, setProductMap] = useState({});
  const [connected, setConnected] = useState(false);

  const callbackRef = useRef(onProductChange);

  useEffect(() => {
    callbackRef.current = onProductChange;
  }, [onProductChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const db = getFirestoreDb();
    if (!db) {
      setConnected(false);
      return;
    }

    let isMounted = true;
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let hasServerSnapshot = false;
    let hasError = false;

    const updateConnectionState = () => {
      if (!isMounted) return;
      setConnected(isOnline && hasServerSnapshot && !hasError);
    };

    const handleOnline = () => {
      isOnline = true;
      updateConnectionState();
    };

    const handleOffline = () => {
      isOnline = false;
      hasServerSnapshot = false;
      updateConnectionState();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const productsRef = collection(db, "products");

    const unsubscribe = onSnapshot(
      productsRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!isMounted) return;
        hasError = false;
        hasServerSnapshot = !snapshot.metadata.fromCache;
        updateConnectionState();

        setProductMap((previous) => {
          const next = { ...previous };

          snapshot.docChanges().forEach((change) => {
            const id = change.doc.id;

            if (change.type === "removed") {
              delete next[id];
              return;
            }

            const data = change.doc.data();
            next[id] = {
              id,
              ...data,
            };
          });

          return next;
        });

        snapshot.docChanges().forEach((change) => {
          const id = change.doc.id;

          if (change.type === "removed") {
            callbackRef.current?.(id, null);
            return;
          }

          callbackRef.current?.(id, {
            id,
            ...change.doc.data(),
          });
        });
      },
      (error) => {
        if (!isMounted) return;
        console.error("[firebase] Products listener:", error.message);
        hasError = true;
        hasServerSnapshot = false;
        updateConnectionState();
      }
    );

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  return { productMap, connected };
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME FEEDBACK                               */
/* -------------------------------------------------------------------------- */

/**
 * Listens for feedback events (new feedback submitted, feedback approved/rejected)
 * using discrete event documents.
 */
export function useRealtimeFeedback({ onNewFeedback, onFeedbackStatusChange, onAnyChange, onReconnect } = {}) {
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef({ onNewFeedback, onFeedbackStatusChange, onAnyChange, onReconnect });

  useEffect(() => {
    callbacksRef.current = { onNewFeedback, onFeedbackStatusChange, onAnyChange, onReconnect };
  }, [onNewFeedback, onFeedbackStatusChange, onAnyChange, onReconnect]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const db = getFirestoreDb();
    if (!db) {
      setConnected(false);
      return;
    }

    let isMounted = true;
    let isInitialSnapshot = true;
    let hasHadServerConnection = false;
    let isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    let hasServerSnapshot = false;
    let hasError = false;

    const updateConnectionState = () => {
      if (!isMounted) return;
      const isLive = isOnline && hasServerSnapshot && !hasError;
      setConnected(isLive);
      if (isLive) {
        if (!hasHadServerConnection) {
          hasHadServerConnection = true;
        } else {
          callbacksRef.current.onReconnect?.();
        }
      }
    };

    const handleOnline = () => {
      isOnline = true;
      updateConnectionState();
    };

    const handleOffline = () => {
      isOnline = false;
      hasServerSnapshot = false;
      updateConnectionState();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const eventsCol = collection(db, "events");
    const eventsQuery = query(eventsCol, orderBy("createdAt", "desc"), limit(30));

    const unsubscribe = onSnapshot(
      eventsQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!isMounted) return;
        hasError = false;
        hasServerSnapshot = !snapshot.metadata.fromCache;
        updateConnectionState();

        if (isInitialSnapshot) {
          isInitialSnapshot = false;
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const id = data.eventId || docSnap.id;
            if (["latest_order", "status_change", "latest_feedback", "feedback_status"].includes(id)) {
              return;
            }
            markEventProcessed(id);
          });
          return;
        }

        const docChanges = snapshot.docChanges();
        const addedChanges = docChanges
          .filter((change) => change.type === "added")
          .reverse();

        for (const change of addedChanges) {
          const data = change.doc.data();
          const eventId = data.eventId || change.doc.id;

          if (["latest_order", "status_change", "latest_feedback", "feedback_status"].includes(eventId)) {
            continue;
          }

          if (isEventProcessed(eventId)) {
            continue;
          }

          markEventProcessed(eventId);
          const payload = data.payload || data;

          if (data.type === "NEW_FEEDBACK") {
            callbacksRef.current.onNewFeedback?.(payload);
            callbacksRef.current.onAnyChange?.(payload);
          } else if (data.type === "FEEDBACK_STATUS_CHANGE") {
            callbacksRef.current.onFeedbackStatusChange?.(payload);
            callbacksRef.current.onAnyChange?.(payload);
          }
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error("[firebase] Feedback events listener error:", error.message);
        hasError = true;
        hasServerSnapshot = false;
        updateConnectionState();
      }
    );

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  return { connected };
}

/* -------------------------------------------------------------------------- */
/*                        FIREBASE CLOUD MESSAGING (CLIENT)                   */
/* -------------------------------------------------------------------------- */

let messagingInstance = null;

/**
 * Lazily initializes and returns Firebase Messaging instance on the client.
 * Returns null if unsupported (e.g. unsupported browser or non-secure context).
 */
export async function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (e) {
    console.warn("[FCM] getFirebaseMessaging initialization warning:", e?.message ?? e);
    return null;
  }
}

/**
 * Requests browser notification permission and retrieves an FCM registration token.
 */
export async function requestPushToken() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("Les notifications ne sont pas supportées par votre navigateur.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Permission refusée. Veuillez autoriser les notifications dans les paramètres de votre navigateur."
        : "Autorisation des notifications non accordée."
    );
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase Messaging n'est pas supporté sur cet appareil / navigateur.");
  }

  const { getToken } = await import("firebase/messaging");

  // Ensure service worker is registered and active
  let swReg = null;
  if ("serviceWorker" in navigator) {
    try {
      swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn("[FCM] Service worker registration error:", err);
      swReg = await navigator.serviceWorker.getRegistration("/").catch(() => null);
    }
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg || undefined,
  });

  if (!token) {
    throw new Error("Impossible d'obtenir un token de notification FCM.");
  }

  return token;
}

function isDuplicateForegroundEvent(eventId) {
  if (!eventId) return false;
  if (isEventProcessed(eventId)) {
    console.log(`[FCM Client] Suppressed duplicate foreground push for eventId: ${eventId}`);
    return true;
  }
  markEventProcessed(eventId);
  return false;
}

/**
 * React hook to manage push notification permissions, registration, and status.
 */
export function usePushNotifications({
  role = "CLIENT",
  orderReference = null,
  customerPhone = null,
} = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [token, setToken] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      const savedToken = localStorage.getItem("bh_fcm_token");
      if (savedToken) {
        setToken(savedToken);
        setIsSubscribed(Notification.permission === "granted");
      }
    }
  }, []);

  // Handle foreground messages with system notification fallback and deduplication
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    (async () => {
      try {
        const messaging = await getFirebaseMessaging();
        if (!isMounted || !messaging) return;

        const { onMessage } = await import("firebase/messaging");
        if (!isMounted) return;

        unsubscribe = onMessage(messaging, async (payload) => {
          console.log("[FCM Client] Foreground push message received:", payload);

          const eventId =
            payload.data?.eventId ||
            (payload.data?.reference
              ? `ref_${payload.data.reference}_${payload.data.status || payload.data.type || "update"}`
              : null) ||
            payload.fcmMessageId ||
            payload.messageId;

          if (eventId && isDuplicateForegroundEvent(eventId)) {
            return;
          }

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            let userLocale = "fr";
            try {
              userLocale =
                localStorage.getItem("blackhousse:locale") ||
                document.documentElement?.lang ||
                navigator?.language?.slice(0, 2) ||
                "fr";
            } catch {}

            let title =
              payload.notification?.title || payload.data?.title || "BlackHousse";
            let body = payload.notification?.body || payload.data?.body || "";

            // Apply multilingual push content matching active customer language
            if (userLocale === "ar") {
              if (payload.data?.title_ar) title = payload.data.title_ar;
              if (payload.data?.body_ar) body = payload.data.body_ar;
            } else if (userLocale === "en") {
              if (payload.data?.title_en) title = payload.data.title_en;
              if (payload.data?.body_en) body = payload.data.body_en;
            }

            const url =
              payload.fcmOptions?.link ||
              payload.data?.url ||
              payload.data?.click_action ||
              "/";
            const tag =
              payload.data?.tag ||
              (payload.data?.reference ? `bh-order-${payload.data.reference}` : "blackhousse-order");

            const options = {
              body,
              icon: payload.notification?.icon || payload.data?.icon || "/icons/icon-192x192.png",
              badge: payload.notification?.badge || payload.data?.badge || "/icons/icon-72x72.png",
              tag,
              renotify: false,
              data: {
                url,
                ...payload.data,
              },
            };

            // Attempt display via service worker first (fully compatible with iOS PWA & Android)
            try {
              if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.getRegistration("/");
                if (reg && "showNotification" in reg) {
                  await reg.showNotification(title, options);
                  console.log(`[FCM Client] Displayed foreground notification via ServiceWorker: "${title}" (tag: ${tag})`);
                  return;
                }
              }
            } catch (swErr) {
              console.warn("[FCM Client] Service worker notification fallback error:", swErr);
            }

            // Fallback to Window Notification constructor for desktop browsers
            try {
              const notif = new Notification(title, options);
              notif.onclick = () => {
                window.focus();
                if (url && url !== "/") window.location.href = url;
              };
              console.log(`[FCM Client] Displayed foreground notification via Notification API: "${title}" (tag: ${tag})`);
            } catch (winNotifErr) {
              console.warn("[FCM Client] Desktop Notification constructor warning:", winNotifErr);
            }
          }
        });
      } catch (err) {
        console.warn("[FCM Client] Foreground message setup warning:", err);
      }
    })();

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  const subscribe = useCallback(
    async (overrides = {}) => {
      setLoading(true);
      setError(null);
      try {
        const currentToken = await requestPushToken();
        setToken(currentToken);
        setPermission("granted");

        const targetRole = overrides.role || role;
        const targetOrderRef =
          overrides.orderReference !== undefined ? overrides.orderReference : orderReference;
        const targetPhone =
          overrides.customerPhone !== undefined ? overrides.customerPhone : customerPhone;

        const res = await fetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: currentToken,
            role: targetRole,
            orderReference: targetOrderRef,
            customerPhone: targetPhone,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Erreur lors de l'enregistrement de la souscription.");
        }

        localStorage.setItem("bh_fcm_token", currentToken);
        setIsSubscribed(true);
        return { success: true, token: currentToken };
      } catch (err) {
        console.error("[FCM] Subscribe error:", err);
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [role, orderReference, customerPhone]
  );

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedToken = token || localStorage.getItem("bh_fcm_token");
      if (savedToken) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: savedToken }),
        }).catch(() => {});
      }
      localStorage.removeItem("bh_fcm_token");
      setToken(null);
      setIsSubscribed(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    isSupported,
    permission,
    isSubscribed,
    token,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
