import crypto from "node:crypto";
import { prisma } from "./prisma.js";

/* -------------------------------------------------------------------------- */
/*                               CONFIGURATION                                */
/* -------------------------------------------------------------------------- */

let _config = null;

/** Reads credentials from env vars only. Fails loudly (lazily) if one is missing. */
function getConfig() {
  if (_config) return _config;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  // Handle keys pasted with surrounding quotes and escaped newlines
  privateKey = privateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  _config = { projectId, clientEmail, privateKey };
  return _config;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------------------------------------------------------- */
/*                         GOOGLE OAUTH ACCESS TOKEN                          */
/* -------------------------------------------------------------------------- */

let cachedToken = null;
let tokenExpiresAt = 0; // milliseconds
let tokenInFlight = null;

function base64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function requestNewToken() {
  const { clientEmail, privateKey } = getConfig();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope:
      "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging",
  };

  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(toSign);
  const jwt = `${toSign}.${sign.sign(privateKey, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Token exchange failed (HTTP ${res.status})`
    );
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

/**
 * Returns a valid Google OAuth2 access token.
 * Concurrent callers share ONE in-flight request (no stampede).
 */
export async function getAccessToken(force = false) {
  if (!force && cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  if (!tokenInFlight) {
    tokenInFlight = requestNewToken().finally(() => {
      tokenInFlight = null;
    });
  }
  return tokenInFlight;
}

/* -------------------------------------------------------------------------- */
/*                            FIRESTORE REST HELPERS                          */
/* -------------------------------------------------------------------------- */

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

async function firestoreRequest(method, url, body) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(8000),
  });

  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Firestore HTTP ${res.status}`);
  }
  return json;
}

const docUrl = (collectionPath, docId) => {
  const { projectId } = getConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${encodeURIComponent(docId)}`;
};

/**
 * Writes a document.
 * merge:false -> replaces the whole document
 * merge:true  -> updates ONLY the given fields (keeps the rest)
 */
async function writeDocument(collectionPath, docId, data, { merge = false } = {}) {
  const payload = toFirestoreFields(data);
  const mask = merge
    ? "?" +
      Object.keys(payload.fields)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join("&")
    : "";
  return firestoreRequest("PATCH", docUrl(collectionPath, docId) + mask, JSON.stringify(payload));
}

async function deleteDocument(collectionPath, docId) {
  return firestoreRequest("DELETE", docUrl(collectionPath, docId));
}

/* ----------------------------- Event pruning ----------------------------- */

let lastPruneTime = 0;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000; // at most once every 6 hours

/**
 * Deletes events older than retentionHours using a real query (no 100-doc limit).
 * Legacy singleton documents are never deleted.
 */
export async function pruneOldEvents(retentionHours = 48) {
  const now = Date.now();
  if (now - lastPruneTime < PRUNE_INTERVAL_MS) return;
  lastPruneTime = now;

  try {
    const { projectId } = getConfig();
    const cutoff = new Date(now - retentionHours * 3600 * 1000).toISOString();

    const rows = await firestoreRequest(
      "POST",
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "events" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "createdAt" },
              op: "LESS_THAN",
              value: { stringValue: cutoff },
            },
          },
          limit: 200,
        },
      })
    );

    const legacy = new Set(["latest_order", "status_change", "latest_feedback", "feedback_status"]);
    const ids = (Array.isArray(rows) ? rows : [])
      .map((r) => r.document?.name?.split("/").pop())
      .filter((id) => id && !legacy.has(id));

    await Promise.allSettled(ids.map((id) => deleteDocument("events", id)));
    if (ids.length) console.log(`[firebase-admin] Pruned ${ids.length} expired event(s)`);
  } catch (err) {
    console.warn("[firebase-admin] Event pruning note:", err.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                               FIRESTORE SYNC                               */
/* -------------------------------------------------------------------------- */

/** 1. New order -> orders/{reference}, events/{eventId}, events/latest_order */
export async function syncOrderCreated(order, options = {}) {
  try {
    const eventId = options.eventId || `evt_order_created_${order.reference}`;
    const createdAt =
      order.createdAt instanceof Date
        ? order.createdAt.toISOString()
        : order.createdAt || new Date().toISOString();

    const orderData = {
      reference: order.reference,
      dailyNumber: order.dailyNumber ?? null,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillment: order.fulfillment,
      total: order.total,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      address: order.address || "",
      municipalityName: order.municipalityName || "",
      itemsCount: order.items?.length || order.itemsCount || 0,
      createdAt,
      updatedAt:
        order.updatedAt instanceof Date ? order.updatedAt.toISOString() : new Date().toISOString(),
    };

    await writeDocument("orders", order.reference, orderData);

    // Sanitized payload for the events collection (no phone / address)
    const eventPayload = {
      reference: order.reference,
      dailyNumber: order.dailyNumber ?? null,
      customerName: order.customerName || "Un client",
      total: Number(order.total) || 0,
      fulfillment: order.fulfillment || "DELIVERY",
      itemsCount: order.items?.length || order.itemsCount || 0,
    };

    await writeDocument("events", eventId, {
      eventId,
      type: "NEW_ORDER",
      entityId: order.reference,
      createdAt,
      payload: eventPayload,
    });

    // Backward compatibility: legacy singleton
    await writeDocument("events", "latest_order", {
      type: "NEW_ORDER",
      eventId,
      ...eventPayload,
      createdAt,
    });

    console.log(`[firebase-admin] Synced new order event ${eventId} (#${order.reference})`);

    await pruneOldEvents();
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore order sync skipped (${err.message})`);
  }
}

/** 2. Status change -> orders/{reference} (MERGE), events/{eventId}, events/status_change */
export async function syncOrderStatus(reference, newStatus, statusLabel = "", options = {}) {
  try {
    const eventId =
      options.eventId ||
      `evt_order_status_${reference}_${newStatus}_${options.timestamp || Date.now()}`;
    const updatedAt = new Date().toISOString();

    // merge:true so the rest of the order document (name, total, address...) is preserved
    await writeDocument(
      "orders",
      reference,
      {
        status: newStatus,
        statusLabel: statusLabel || newStatus,
        updatedAt,
      },
      { merge: true }
    );

    const eventPayload = {
      reference,
      status: newStatus,
      statusLabel: statusLabel || newStatus,
      fulfillment: options.fulfillment || null,
    };

    await writeDocument("events", eventId, {
      eventId,
      type: "ORDER_STATUS_CHANGE",
      entityId: reference,
      createdAt: updatedAt,
      payload: eventPayload,
    });

    // Backward compatibility: legacy singleton
    await writeDocument("events", "status_change", {
      type: "STATUS_CHANGE",
      eventId,
      ...eventPayload,
      updatedAt,
    });

    console.log(`[firebase-admin] Synced status event ${eventId} (${newStatus}) for order ${reference}`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore status sync skipped (${err.message})`);
  }
}

/** 3. Product availability / price changes (partial update -> merge) */
export async function syncProductChange(productId, { available, isActive, price, name }) {
  try {
    const updateData = {
      id: productId,
      updatedAt: new Date().toISOString(),
    };

    if (available !== undefined) updateData.available = Boolean(available);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (price !== undefined) updateData.price = Number(price);
    if (name !== undefined) updateData.name = String(name);

    await writeDocument("products", productId, updateData, { merge: true });
    console.log(`[firebase-admin] Synced product ${productId} to Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore product sync skipped (${err.message})`);
  }
}

export async function syncProductDelete(productId) {
  try {
    await deleteDocument("products", productId);
    console.log(`[firebase-admin] Deleted product ${productId} from Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore product delete skipped (${err.message})`);
  }
}

/** 4. New feedback */
export async function syncFeedbackCreated(feedback, options = {}) {
  try {
    const eventId = options.eventId || `evt_feedback_created_${feedback.id}`;
    const createdAt =
      feedback.createdAt instanceof Date
        ? feedback.createdAt.toISOString()
        : feedback.createdAt || new Date().toISOString();

    const eventPayload = {
      id: feedback.id,
      name: feedback.name || "Client",
      rating: feedback.rating,
      hasComment: Boolean(feedback.comment && feedback.comment.trim().length > 0),
      status: feedback.status || "PENDING",
    };

    await writeDocument("events", eventId, {
      eventId,
      type: "NEW_FEEDBACK",
      entityId: feedback.id,
      createdAt,
      payload: eventPayload,
    });

    await writeDocument("events", "latest_feedback", {
      type: "NEW_FEEDBACK",
      eventId,
      ...eventPayload,
      comment: feedback.comment || "",
      createdAt,
    });

    console.log(`[firebase-admin] Synced new feedback event ${eventId} (${feedback.id})`);

    await pruneOldEvents();
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore feedback sync skipped (${err.message})`);
  }
}

/** Feedback approval / rejection */
export async function syncFeedbackStatus(id, newStatus, options = {}) {
  try {
    const eventId =
      options.eventId ||
      `evt_feedback_status_${id}_${newStatus}_${options.timestamp || Date.now()}`;
    const updatedAt = new Date().toISOString();

    const eventPayload = { id, status: newStatus };

    await writeDocument("events", eventId, {
      eventId,
      type: "FEEDBACK_STATUS_CHANGE",
      entityId: id,
      createdAt: updatedAt,
      payload: eventPayload,
    });

    await writeDocument("events", "feedback_status", {
      type: "FEEDBACK_STATUS_CHANGE",
      eventId,
      ...eventPayload,
      updatedAt,
    });

    console.log(`[firebase-admin] Synced feedback status ${eventId} (${id} -> ${newStatus})`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore feedback status sync skipped (${err.message})`);
  }
}

/* -------------------------------------------------------------------------- */
/*                        FIREBASE CLOUD MESSAGING (FCM)                      */
/* -------------------------------------------------------------------------- */

const FCM_TIMEOUT_MS = 6000;
const FCM_MAX_ATTEMPTS = 3;
const RETRYABLE_HTTP = new Set([429, 500, 502, 503, 504]);

// A token is dead ONLY when FCM explicitly says so (never on a plain 404)
function isDeadTokenError(errObj) {
  const details = Array.isArray(errObj?.details) ? errObj.details : [];
  if (details.some((d) => d?.errorCode === "UNREGISTERED")) return true;
  return (
    errObj?.status === "INVALID_ARGUMENT" &&
    /registration token/i.test(errObj?.message || "")
  );
}

/* ---------- Dedupe backed by the database (works across Vercel instances) ---------- */

/** Returns true if this caller is the first to claim the key, false if already claimed. */
async function claimEvent(key) {
  try {
    await prisma.sentEvent.create({ data: { id: key } });
    return true;
  } catch (e) {
    if (e?.code === "P2002") return false; // already claimed
    // If the dedupe table itself fails, prefer sending over silently dropping
    console.warn("[FCM Server] claimEvent error:", e?.message);
    return true;
  }
}

async function releaseEvent(key) {
  await prisma.sentEvent.delete({ where: { id: key } }).catch(() => {});
}

async function cleanupOldEvents() {
  if (Math.random() > 0.02) return; // ~2% of calls
  await prisma.sentEvent
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } })
    .catch(() => {});
}

/* ---------- Single push: timeout + retry + safe token cleanup ---------- */

/** Never throws. Always returns { success, error?, deadToken? }. */
export async function sendFcmMessage({
  token,
  title,
  body,
  url = "/",
  data = {},
  icon = "/icons/icon-192x192.png",
  badge = "/icons/icon-72x72.png",
}) {
  if (!token) return { success: false, error: "Missing token" };

  let projectId;
  try {
    projectId = getConfig().projectId;
  } catch (err) {
    return { success: false, error: err.message };
  }

  const eventId =
    data.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const tag =
    data.tag || (data.reference ? `bh-order-${data.reference}` : "blackhousse-alert");

  const messagePayload = {
    message: {
      token,
      notification: { title: String(title), body: String(body) },
      data: {
        url: String(url),
        title: String(title),
        body: String(body),
        click_action: String(url),
        eventId: String(eventId),
        tag: String(tag),
        ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")])),
      },
      webpush: {
        fcm_options: { link: url },
        headers: { Urgency: "high", TTL: "86400" },
        notification: {
          title: String(title),
          body: String(body),
          icon,
          badge,
          tag: String(tag),
          renotify: false,
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
      },
    },
  };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  let lastError = "Unknown error";
  let refreshedAuth = false;

  for (let attempt = 1; attempt <= FCM_MAX_ATTEMPTS; attempt++) {
    try {
      const accessToken = await getAccessToken();

      const resRaw = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
        signal: AbortSignal.timeout(FCM_TIMEOUT_MS),
      });

      const res = await resRaw.json().catch(() => ({}));

      // Success
      if (resRaw.ok && !res.error) {
        return { success: true, name: res.name, eventId, attempts: attempt };
      }

      const errObj = res.error || { message: `HTTP ${resRaw.status}` };
      lastError = errObj.message || `HTTP ${resRaw.status}`;

      // Dead token: delete it and stop (no retry)
      if (isDeadTokenError(errObj)) {
        await prisma.pushSubscription.deleteMany({ where: { token } }).catch(() => {});
        console.log(`[FCM Server] Removed dead token ${token.slice(0, 10)}...`);
        return { success: false, error: lastError, deadToken: true };
      }

      // Expired auth: force a fresh access token once, then retry
      if ((resRaw.status === 401 || resRaw.status === 403) && !refreshedAuth) {
        refreshedAuth = true;
        await getAccessToken(true).catch(() => {});
        continue;
      }

      // Temporary FCM problem: retry with backoff
      if (RETRYABLE_HTTP.has(resRaw.status) && attempt < FCM_MAX_ATTEMPTS) {
        const retryAfter = Number(resRaw.headers.get("retry-after"));
        const wait =
          retryAfter > 0 ? Math.min(retryAfter * 1000, 4000) : 500 * 2 ** (attempt - 1);
        console.warn(
          `[FCM Server] HTTP ${resRaw.status}, retry ${attempt}/${FCM_MAX_ATTEMPTS - 1} in ${wait}ms`
        );
        await sleep(wait);
        continue;
      }

      // Permanent error (bad payload, wrong project...): no retry, nothing deleted
      console.warn(`[FCM Server] Permanent error for ${token.slice(0, 10)}...: ${lastError}`);
      return { success: false, error: lastError };
    } catch (err) {
      // Network error or timeout: retry
      lastError =
        err?.name === "TimeoutError" ? "FCM request timed out" : err?.message || String(err);
      if (attempt < FCM_MAX_ATTEMPTS) {
        const wait = 500 * 2 ** (attempt - 1);
        console.warn(
          `[FCM Server] ${lastError}, retry ${attempt}/${FCM_MAX_ATTEMPTS - 1} in ${wait}ms`
        );
        await sleep(wait);
        continue;
      }
    }
  }

  return { success: false, error: lastError, attempts: FCM_MAX_ATTEMPTS };
}

/** Sends one message to many tokens and logs the real outcome. */
async function sendToAll(tokens, message, label) {
  const results = await Promise.all(tokens.map((token) => sendFcmMessage({ ...message, token })));
  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  if (failed.length) {
    console.warn(
      `[FCM Server] ${failed.length}/${tokens.length} pushes failed for ${label}:`,
      failed.map((f) => f.error)
    );
  }
  console.log(`[FCM Server] ${sent}/${tokens.length} pushes sent for ${label}`);

  // true when nothing was delivered AND it was not only dead tokens
  const shouldRelease =
    sent === 0 && !(failed.length > 0 && failed.every((f) => f.deadToken));

  return { sent, failed, shouldRelease };
}

/* ----------------------- Admin: new order notification ----------------------- */

export async function notifyAdminsNewOrder(order, options = {}) {
  let claimedKey = null;

  try {
    if (!order || !order.reference) return;

    const eventId = options.eventId || `evt_order_created_${order.reference}`;
    const dedupeKey = `admin_new_order_${eventId}`;

    if (!(await claimEvent(dedupeKey))) {
      console.log(
        `[FCM Server] Suppressed duplicate new order push for #${order.reference} (eventId: ${eventId})`
      );
      return;
    }
    claimedKey = dedupeKey;

    const adminSubs = await prisma.pushSubscription.findMany({
      where: { role: "ADMIN" },
      select: { token: true },
    });

    if (!adminSubs.length) {
      console.log("[FCM Server] No admin devices registered for push notifications");
      await releaseEvent(claimedKey);
      claimedKey = null;
      return;
    }

    const title = `🔔 Nouvelle commande #${order.dailyNumber || order.reference}`;
    const fulfillmentText = order.fulfillment === "DELIVERY" ? "Livraison" : "À emporter";
    const body = `${order.customerName || "Un client"} a commandé pour ${order.total} DZD (${fulfillmentText})`;
    const url = `/Admin?tab=orders&ref=${order.reference}`;
    const tag = `bh-order-${order.reference}`;

    const uniqueTokens = [...new Set(adminSubs.map((s) => s.token))];
    console.log(
      `[FCM Server] Dispatching new order notification for #${order.reference} (eventId: ${eventId}) to ${uniqueTokens.length} admin device(s)`
    );

    const { shouldRelease } = await sendToAll(
      uniqueTokens,
      {
        title,
        body,
        url,
        data: {
          type: "NEW_ORDER",
          reference: order.reference,
          dailyNumber: String(order.dailyNumber || ""),
          total: String(order.total),
          fulfillment: String(order.fulfillment),
          eventId,
          tag,
        },
      },
      `new order #${order.reference}`
    );

    if (shouldRelease) {
      await releaseEvent(claimedKey);
      claimedKey = null;
    }

    await cleanupOldEvents();
  } catch (err) {
    console.warn("[FCM Server] notifyAdminsNewOrder error:", err?.message);
    if (claimedKey) await releaseEvent(claimedKey);
  }
}

/* ---------------------- Admin: order cancelled notification ---------------------- */

export async function notifyAdminsOrderCancelled(order, options = {}) {
  let claimedKey = null;

  try {
    if (!order || !order.reference) return;

    const eventId = options.eventId || `evt_order_cancelled_${order.reference}`;
    const dedupeKey = `admin_cancel_${eventId}`;

    if (!(await claimEvent(dedupeKey))) {
      console.log(
        `[FCM Server] Suppressed duplicate cancellation push for #${order.reference} (eventId: ${eventId})`
      );
      return;
    }
    claimedKey = dedupeKey;

    const adminSubs = await prisma.pushSubscription.findMany({
      where: { role: "ADMIN" },
      select: { token: true },
    });

    if (!adminSubs.length) {
      console.log("[FCM Server] No admin devices registered for push notifications");
      await releaseEvent(claimedKey);
      claimedKey = null;
      return;
    }

    const title = `❌ Commande annulée #${order.dailyNumber || order.reference}`;
    const body = `${order.customerName || "Le client"} a annulé sa commande (${order.total} DZD)`;
    const url = `/Admin?tab=orders&ref=${order.reference}`;
    const tag = `bh-order-${order.reference}`;

    const uniqueTokens = [...new Set(adminSubs.map((s) => s.token))];
    console.log(
      `[FCM Server] Dispatching cancellation notification for #${order.reference} (eventId: ${eventId}) to ${uniqueTokens.length} admin device(s)`
    );

    const { shouldRelease } = await sendToAll(
      uniqueTokens,
      {
        title,
        body,
        url,
        data: {
          type: "ORDER_CANCELLED",
          reference: order.reference,
          dailyNumber: String(order.dailyNumber || ""),
          total: String(order.total || ""),
          status: "CANCELLED",
          eventId,
          tag,
        },
      },
      `cancellation #${order.reference}`
    );

    if (shouldRelease) {
      await releaseEvent(claimedKey);
      claimedKey = null;
    }

    await cleanupOldEvents();
  } catch (err) {
    console.warn("[FCM Server] notifyAdminsOrderCancelled error:", err?.message);
    if (claimedKey) await releaseEvent(claimedKey);
  }
}

/* ------------------------ Customer: order status update ------------------------ */

export async function notifyCustomerOrderStatus(
  reference,
  newStatus,
  statusLabel = "",
  fulfillment = null,
  options = {}
) {
  let claimedKey = null;

  try {
    if (!reference || !newStatus) return;

    const eventId =
      options.eventId ||
      `evt_order_status_${reference}_${newStatus}_${options.timestamp || Date.now()}`;
    const dedupeKey = `customer_status_${eventId}`;

    // Dedupe across all serverless instances
    if (!(await claimEvent(dedupeKey))) {
      console.log(
        `[FCM Server] Suppressed duplicate push for #${reference} -> ${newStatus} (eventId: ${eventId})`
      );
      return;
    }
    claimedKey = dedupeKey;

    const order = await prisma.order
      .findUnique({
        where: { reference },
        select: { customerPhone: true, fulfillment: true, customerName: true },
      })
      .catch((e) => {
        console.warn("[FCM Server] Order lookup failed:", e?.message);
        return null;
      });

    const isDelivery = fulfillment
      ? String(fulfillment).toUpperCase() === "DELIVERY"
      : order?.fulfillment === "DELIVERY";

    const subs = await prisma.pushSubscription.findMany({
      where: {
        OR: [
          { orderReference: reference },
          ...(order?.customerPhone ? [{ customerPhone: order.customerPhone }] : []),
        ],
      },
      select: { token: true },
    });

    if (!subs.length) {
      console.log(`[FCM Server] No customer device registered for order #${reference}`);
      return;
    }

    const uniqueTokens = [...new Set(subs.map((s) => s.token))];

    let title = "📦 Mise à jour de votre commande";
    let body = `Statut : ${statusLabel || newStatus}`;
    let titleAr = "📦 تحديث بخصوص طلبك";
    let bodyAr = `حالة الطلب : ${newStatus}`;
    let titleEn = "📦 Order update";
    let bodyEn = `Status : ${newStatus}`;

    switch (newStatus) {
      case "CONFIRMED":
        title = "✅ Commande confirmée";
        body = `Votre commande #${reference} est confirmée et en attente de préparation.`;
        titleAr = "✅ تم تأكيد الطلب";
        bodyAr = `طلبك #${reference} تم تأكيده وهو في انتظار التحضير.`;
        titleEn = "✅ Order confirmed";
        bodyEn = `Your order #${reference} is confirmed and awaiting preparation.`;
        break;
      case "PREPARING":
        title = "👨‍🍳 En préparation";
        body = `Nos cuisiniers préparent actuellement votre commande #${reference} !`;
        titleAr = "👨‍🍳 قيد التحضير";
        bodyAr = `طباخونا يقومون بتحضير طلبك #${reference} الآن!`;
        titleEn = "👨‍🍳 In preparation";
        bodyEn = `Our kitchen is currently preparing your order #${reference}!`;
        break;
      case "READY":
        title = isDelivery ? "🛵 En attente de livraison" : "✨ Commande prête";
        body = isDelivery
          ? `Votre commande #${reference} est prête et en attente du livreur !`
          : `Votre commande #${reference} est prête à être récupérée au restaurant !`;
        titleAr = isDelivery ? "🛵 في انتظار التوصيل" : "✨ الطلب جاهز";
        bodyAr = isDelivery
          ? `طلبك #${reference} جاهز وفي انتظار عامل التوصيل!`
          : `طلبك #${reference} جاهز للاستلام في المطعم!`;
        titleEn = isDelivery ? "🛵 Awaiting delivery" : "✨ Order ready";
        bodyEn = isDelivery
          ? `Your order #${reference} is ready and waiting for the driver!`
          : `Your order #${reference} is ready for pickup at the restaurant!`;
        break;
      case "OUT_FOR_DELIVERY":
        title = "🛵 En cours de livraison";
        body = `Le livreur est en route avec votre commande #${reference} !`;
        titleAr = "🛵 في الطريق إليك";
        bodyAr = `عامل التوصيل في طريقه إليك مع طلبك #${reference}!`;
        titleEn = "🛵 Out for delivery";
        bodyEn = `The driver is on the way with your order #${reference}!`;
        break;
      case "COMPLETED":
        title = "🎉 Commande terminée";
        body = `Votre commande #${reference} a été remise avec succès. Bon appétit !`;
        titleAr = "🎉 تم تسليم الطلب";
        bodyAr = `تم تسليم طلبك #${reference} بنجاح. بالهناء والشفاء!`;
        titleEn = "🎉 Order completed";
        bodyEn = `Your order #${reference} has been completed. Enjoy your meal!`;
        break;
      case "CANCELLED":
        title = "❌ Commande annulée";
        body = `Votre commande #${reference} a été annulée.`;
        titleAr = "❌ تم إلغاء الطلب";
        bodyAr = `تم إلغاء طلبك #${reference}.`;
        titleEn = "❌ Order cancelled";
        bodyEn = `Your order #${reference} has been cancelled.`;
        break;
    }

    const url = `/Commande?track=${reference}`;
    const tag = `bh-order-${reference}`;

    console.log(
      `[FCM Server] Dispatching push for #${reference} -> ${newStatus} (eventId: ${eventId}) to ${uniqueTokens.length} device(s)`
    );

    const { shouldRelease } = await sendToAll(
      uniqueTokens,
      {
        title,
        body,
        url,
        data: {
          type: "STATUS_CHANGE",
          reference,
          status: newStatus,
          fulfillment: isDelivery ? "DELIVERY" : "PICKUP",
          eventId,
          tag,
          title_ar: titleAr,
          body_ar: bodyAr,
          title_fr: title,
          body_fr: body,
          title_en: titleEn,
          body_en: bodyEn,
        },
      },
      `status #${reference} -> ${newStatus}`
    );

    // Every send failed: release the claim so a later retry of the same event may try again
    if (shouldRelease) {
      await releaseEvent(claimedKey);
      claimedKey = null;
    }

    await cleanupOldEvents();
  } catch (err) {
    console.warn("[FCM Server] notifyCustomerOrderStatus error:", err?.message);
    if (claimedKey) await releaseEvent(claimedKey);
  }
}

/* ------------------------------- Test push ------------------------------- */

export async function sendTestNotification(token) {
  const eventId = `BH_TEST_${Date.now()}`;
  return sendFcmMessage({
    token,
    title: "🔔 Test BlackHousse",
    body: "Vos notifications push sont activées et fonctionnent parfaitement !",
    url: "/Admin",
    data: {
      type: "TEST_NOTIFICATION",
      eventId,
      tag: "bh-test-notification",
      timestamp: new Date().toISOString(),
    },
  });
}