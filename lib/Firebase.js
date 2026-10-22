
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  collection,
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
 * Listens for order creation events and order status changes.
 *
 * Expected Firestore documents:
 * events/latest_order
 * events/status_change
 *
 * Options:
 * onNewOrder(data)
 * onStatusChange(data)
 * onAnyChange(data)
 */
export function useRealtimeAdminOrders({
  onNewOrder,
  onStatusChange,
  onAnyChange,
} = {}) {
  const [lastEvent, setLastEvent] = useState(null);
  const [connected, setConnected] = useState(false);

  const callbacksRef = useRef({
    onNewOrder,
    onStatusChange,
    onAnyChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewOrder,
      onStatusChange,
      onAnyChange,
    };
  }, [onNewOrder, onStatusChange, onAnyChange]);

  useEffect(() => {
    const db = getFirestoreDb();

    if (!db) {
      setConnected(false);
      return;
    }

    let isFirstOrderSnapshot = true;

    const latestOrderRef = doc(db, "events", "latest_order");
    const statusChangeRef = doc(db, "events", "status_change");

    const unsubscribeOrder = onSnapshot(
      latestOrderRef,
      (snapshot) => {
        setConnected(true);

        if (isFirstOrderSnapshot) {
          isFirstOrderSnapshot = false;

          // Initial snapshot is not treated as a new order.
          return;
        }

        if (!snapshot.exists()) return;

        const data = snapshot.data();

        setLastEvent(data);
        callbacksRef.current.onNewOrder?.(data);
        callbacksRef.current.onAnyChange?.(data);
      },
      (error) => {
        console.error("[firebase] Order event listener:", error.message);
        setConnected(false);
      }
    );

    const unsubscribeStatus = onSnapshot(
      statusChangeRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const data = snapshot.data();

        callbacksRef.current.onStatusChange?.(data);
        callbacksRef.current.onAnyChange?.(data);
      },
      (error) => {
        console.error("[firebase] Status event listener:", error.message);
        setConnected(false);
      }
    );

    return () => {
      unsubscribeOrder();
      unsubscribeStatus();
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

    const db = getFirestoreDb();

    if (!db) {
      setLiveOrder(null);
      setLoading(false);
      setConnected(false);
      return;
    }

    setLoading(true);
    setConnected(false);
    setLiveOrder(null);

    const orderRef = doc(db, "orders", reference);

    const unsubscribe = onSnapshot(
      orderRef,
      (snapshot) => {
        setConnected(true);
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
        console.error("[firebase] Customer order listener:", error.message);
        setConnected(false);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reference]);

  return { liveOrder, loading, connected };
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME PRODUCTS                               */
/* -------------------------------------------------------------------------- */

/**
 * Listens to product changes.
 *
 * Callback:
 * onProductChange(id, data)
 *
 * Product fields can include:
 * available, isActive, price, name, etc.
 */
export function useRealtimeProducts(onProductChange) {
  const [productMap, setProductMap] = useState({});
  const [connected, setConnected] = useState(false);

  const callbackRef = useRef(onProductChange);

  useEffect(() => {
    callbackRef.current = onProductChange;
  }, [onProductChange]);

  useEffect(() => {
    const db = getFirestoreDb();

    if (!db) {
      setConnected(false);
      return;
    }

    const productsRef = collection(db, "products");

    const unsubscribe = onSnapshot(
      productsRef,
      (snapshot) => {
        setConnected(true);

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
        console.error("[firebase] Products listener:", error.message);
        setConnected(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { productMap, connected };
}

/* -------------------------------------------------------------------------- */
/*                            REALTIME FEEDBACK                               */
/* -------------------------------------------------------------------------- */

/**
 * Listens for feedback events (new feedback submitted, feedback approved/rejected).
 */
export function useRealtimeFeedback({ onNewFeedback, onFeedbackStatusChange, onAnyChange } = {}) {
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef({ onNewFeedback, onFeedbackStatusChange, onAnyChange });

  useEffect(() => {
    callbacksRef.current = { onNewFeedback, onFeedbackStatusChange, onAnyChange };
  }, [onNewFeedback, onFeedbackStatusChange, onAnyChange]);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db) {
      setConnected(false);
      return;
    }

    let isFirstSnapshot = true;
    const latestFeedbackRef = doc(db, "events", "latest_feedback");
    const feedbackStatusRef = doc(db, "events", "feedback_status");

    const unsubscribeNew = onSnapshot(
      latestFeedbackRef,
      (snapshot) => {
        setConnected(true);
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return;
        }
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        callbacksRef.current.onNewFeedback?.(data);
        callbacksRef.current.onAnyChange?.(data);
      },
      (error) => {
        console.error("[firebase] Feedback event listener:", error.message);
        setConnected(false);
      }
    );

    const unsubscribeStatus = onSnapshot(
      feedbackStatusRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        callbacksRef.current.onFeedbackStatusChange?.(data);
        callbacksRef.current.onAnyChange?.(data);
      },
      (error) => {
        console.error("[firebase] Feedback status listener:", error.message);
        setConnected(false);
      }
    );

    return () => {
      unsubscribeNew();
      unsubscribeStatus();
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

  // Handle foreground messages with system notification fallback
  useEffect(() => {
    let unsubscribe = null;
    (async () => {
      const messaging = await getFirebaseMessaging();
      if (messaging) {
        const { onMessage } = await import("firebase/messaging");
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("[FCM] Foreground push message received:", payload);

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const title =
              payload.notification?.title || payload.data?.title || "BlackHousse";
            const options = {
              body: payload.notification?.body || payload.data?.body || "",
              icon: payload.notification?.icon || payload.data?.icon || "/icons/icon-192x192.png",
              badge: payload.notification?.badge || payload.data?.badge || "/icons/icon-72x72.png",
              data: {
                url:
                  payload.fcmOptions?.link ||
                  payload.data?.url ||
                  payload.data?.click_action ||
                  "/",
                ...payload.data,
              },
            };
            try {
              const notif = new Notification(title, options);
              notif.onclick = () => {
                window.focus();
                const url = options.data?.url;
                if (url && url !== "/") window.location.href = url;
              };
            } catch (_) {}
          }
        });
      }
    })();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
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
