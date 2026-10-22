import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "./prisma.js";

const execFileAsync = promisify(execFile);

// Service account credentials
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  "blackhousse-902ef";

const clientEmail =
  process.env.FIREBASE_CLIENT_EMAIL ||
  "firebase-adminsdk-fbsvc@blackhousse-902ef.iam.gserviceaccount.com";

const privateKey = (
  process.env.FIREBASE_PRIVATE_KEY ||
  `-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDZkE99uL8ZySqf\nyUCrnpXYbot/rz5j3HVt2Zk7DTleIjUx3/AzbUaJhAX+6n51qxjFhQPHqqAQY1/H\nHbKHeNTyW9ysBIshRwBbcMZAS80HNtPLGc1DOT57v87nIK5Slge/Jgo6ax/rSMiG\ndrXgU6SaoMGCZ/jUjfoKx7KVRgKQOHK05UwahOyvln20wgv7XUWeV9rKk/aWDFId\nC/crCSvIpCbgZ5afPH2udUXplya+kLKcevjeFMiniIORC8NinzUgM14gBRcip7BG\nPUwOeG7TfRyfwhQ12ZlznZTsdsRWxKPUm053wbAXlaxGbN43bcvOqt7YEmhZq2yD\nVmMCfYQ/AgMBAAECggEADowxJ7vxwBymczBdP0Lt/1HgL0KD9OBDh3vhKVF7prxT\nO3ZSgaEEWKLX78q1EZ/5Z3buE/mbYfa/618kYx1rFJjPfnHmh7jpE83Mdw70GU/+\nOEdz/tNWE6cPHUwfIlPFfG+W7kvf3FC6lkGPBpf+ARgcuGArA4BKDVLhfkyQuuno\niY31Vy0zQvRr5IC7OZvjhWw6Skv8UHRJdc08AuXTJL7D0LOc5WhZETPW6BV2ve1M\ndhjP6CQK2wTez1Pfmz1O+0P0sysmQwrvMWnps403q1nGht1DlYavjaedZAYSLZ7E\nb8gA8vccBWKrPHBRv2+bBnIB6IiR0fHTBc1RvmGgMQKBgQD7g11uQFcxpuCtJJNk\nVaX7P5lwo/xRe6wMwTihHonuBdgIvaYVcVVhTsQSTyCyh/RhjyrBoHwK9Z+ocNyl\n/Rtdkjh/dZNETfitGJP9F7J6EEEOo+wqM0ELYinloxN7HSGYOK9P7LclsoxMoPTu\noYJ/hComVH5W0uVfscbgaeNO1wKBgQDdceblTGy0AMupCrr9vF0nx7BsOSE+DRR7\n9nnoq68zPFj0WemjVFDj2e6IxRMbRy/znkeO2OMAmn/7ZWGdhjjy31kxmcHsu94q\nW0qbHTSZTheG7iqSI11Ke1qq2zgjZmBvBDIlmnLOXU74xAYXZPStKDKhTVOly/Yk\nTRhRIifQ2QKBgQCPdEniDIivJUOY/fejjsZxG8Fk4eOUhjmHvN2T6Fs7i9HAiosk\nR9QvAEINP1yi97CHxKTac7LMfXRnGph/hHILWM8ow+MPXnmsIQynmtCNlp/EvfKB\nz2IWIBNNi0odOmxi6lH0AEwmEES9oECTq0NHgBaabi7xTrDNeBS7AypHWQJ/HyPl\nVFlq7+UsvpjDsurKLs3mAVIHWrJ8LvJ6Mj3yZUIXQEVklZNFzMTYxmLwTOW12Ixp\ng6z8Pxl65d9b2ssFNyIxaMg2fRPuKgasdyOkQeq5ZEAZvHM8qzytg1lQi6nZ5cKx\nSphtjJeSg2kNcjzAK5l7hTNaj/YepvwwbzheYQKBgHjazra2LTWdM9wtyqS0nhEV\nTeUQmfK4IeGxAcjAy0trJJNHF+SblfQcGjo2I9cbOJX2QInFkIT0lC40a6jids2Q\nSi8Vuau8Pw0jQGajcd7s4vWCIcH1OnK2i8G0m2NxNTTv2RX4xg6Wt0ROwvtyPdb4\nzy2vxlhtmqlbIZEiX/os\n-----END PRIVATE KEY-----\n`
).replace(/\\n/g, "\n");

// Token cache
let cachedToken = null;
let tokenExpiresAt = 0;

function base64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Gets a valid Google OAuth2 access token for Firebase/Firestore
 */
export async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

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
  const signature = sign.sign(privateKey, "base64url");
  const jwt = `${toSign}.${signature}`;

  const isWin = process.platform === "win32";
  const bin = isWin ? "curl.exe" : "curl";

  try {
    const { stdout } = await execFileAsync(bin, [
      "-s",
      "-X", "POST",
      "-H", "Content-Type: application/x-www-form-urlencoded",
      "-d", `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      "https://oauth2.googleapis.com/token",
    ]);

    const data = JSON.parse(stdout);
    if (!data.access_token) {
      throw new Error(data.error_description || data.error || "Failed to acquire token");
    }

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600);
    return cachedToken;
  } catch (err) {
    console.error("[firebase-admin] token exchange error:", err.message);
    throw err;
  }
}

/**
 * Converts a JS value to Firestore REST format
 */
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

/**
 * Low-level write document to Firestore via REST
 */
async function writeDocument(collectionPath, docId, data) {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${docId}`;
  const body = JSON.stringify(toFirestoreFields(data));

  const isWin = process.platform === "win32";
  const bin = isWin ? "curl.exe" : "curl";

  const { stdout } = await execFileAsync(bin, [
    "-s",
    "-X", "PATCH",
    "-H", `Authorization: Bearer ${token}`,
    "-H", "Content-Type: application/json",
    "-d", body,
    url,
  ]);

  const res = JSON.parse(stdout);
  if (res.error) {
    throw new Error(res.error.message || JSON.stringify(res.error));
  }
  return res;
}

/**
 * Low-level delete document from Firestore via REST
 */
async function deleteDocument(collectionPath, docId) {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${docId}`;

  const isWin = process.platform === "win32";
  const bin = isWin ? "curl.exe" : "curl";

  const { stdout } = await execFileAsync(bin, [
    "-s",
    "-X", "DELETE",
    "-H", `Authorization: Bearer ${token}`,
    url,
  ]);

  return stdout ? JSON.parse(stdout) : {};
}

/* ----------------------------- Public API ----------------------------- */

/**
 * 1. Synchronize newly created order to Firestore in real time
 */
export async function syncOrderCreated(order) {
  try {
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
      itemsCount: order.items?.length || 0,
      createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : new Date().toISOString(),
    };

    // Write to orders collection
    await writeDocument("orders", order.reference, orderData);

    // Write event to notify admin
    await writeDocument("events", "latest_order", {
      type: "NEW_ORDER",
      reference: order.reference,
      dailyNumber: order.dailyNumber ?? null,
      customerName: order.customerName,
      total: order.total,
      createdAt: new Date().toISOString(),
    });

    console.log(`[firebase-admin] Synced new order ${order.reference} (Daily #${order.dailyNumber}) to Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore order sync skipped (${err.message})`);
  }
}

/**
 * 2. Synchronize order status changes to Firestore in real time
 */
export async function syncOrderStatus(reference, newStatus, statusLabel = "") {
  try {
    const updateData = {
      status: newStatus,
      statusLabel: statusLabel || newStatus,
      updatedAt: new Date().toISOString(),
    };

    await writeDocument("orders", reference, updateData);

    // Also emit an event for admin & customer live listeners
    await writeDocument("events", "status_change", {
      type: "STATUS_CHANGE",
      reference,
      status: newStatus,
      statusLabel: statusLabel || newStatus,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[firebase-admin] Synced status ${newStatus} for order ${reference}`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore status sync skipped (${err.message})`);
  }
}

/**
 * 3. Synchronize product availability changes to Firestore in real time
 */
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

    await writeDocument("products", productId, updateData);
    console.log(`[firebase-admin] Synced product ${productId} availability to Firestore:`, updateData);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore product sync skipped (${err.message})`);
  }
}

/**
 * Synchronize product deletion to Firestore in real time
 */
export async function syncProductDelete(productId) {
  try {
    await deleteDocument("products", productId);
    console.log(`[firebase-admin] Deleted product ${productId} from Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore product delete skipped (${err.message})`);
  }
}

/**
 * 4. Synchronize new feedback event to Firestore in real time
 */
export async function syncFeedbackCreated(feedback) {
  try {
    const data = {
      type: "NEW_FEEDBACK",
      id: feedback.id,
      name: feedback.name,
      rating: feedback.rating,
      comment: feedback.comment || "",
      status: feedback.status,
      createdAt: feedback.createdAt instanceof Date ? feedback.createdAt.toISOString() : new Date().toISOString(),
    };

    await writeDocument("events", "latest_feedback", data);
    console.log(`[firebase-admin] Synced new feedback event ${feedback.id} to Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore feedback sync skipped (${err.message})`);
  }
}

/**
 * Synchronize feedback status change (approval/rejection) to Firestore in real time
 */
export async function syncFeedbackStatus(id, newStatus) {
  try {
    const data = {
      type: "FEEDBACK_STATUS_CHANGE",
      id,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    await writeDocument("events", "feedback_status", data);
    console.log(`[firebase-admin] Synced feedback status change ${id} (${newStatus}) to Firestore`);
  } catch (err) {
    console.warn(`[firebase-admin] Note: Firestore feedback status sync skipped (${err.message})`);
  }
}

/* -------------------------------------------------------------------------- */
/*                        FIREBASE CLOUD MESSAGING (FCM)                      */
/* -------------------------------------------------------------------------- */

/**
 * Sends a single push notification via Firebase Cloud Messaging v1 REST API
 */
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

  try {
    const accessToken = await getAccessToken();
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const messagePayload = {
      message: {
        token,
        notification: {
          title: String(title),
          body: String(body),
        },
        data: {
          url: String(url),
          title: String(title),
          body: String(body),
          click_action: String(url),
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
          ),
        },
        webpush: {
          fcm_options: {
            link: url,
          },
          notification: {
            title: String(title),
            body: String(body),
            icon,
            badge,
            vibrate: [200, 100, 200],
            requireInteraction: true,
          },
        },
      },
    };

    const resRaw = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const res = await resRaw.json().catch(() => ({}));

    if (res.error || !resRaw.ok) {
      const errObj = res.error || { message: `HTTP ${resRaw.status}` };
      const errCode = errObj.details?.[0]?.errorCode || errObj.status || resRaw.status;
      console.warn(`[FCM] Send error for token ${token.slice(0, 10)}...:`, errObj.message || errCode);

      // Auto-clean expired or invalid registration tokens from the database
      if (
        errCode === "UNREGISTERED" ||
        errObj.code === 404 ||
        resRaw.status === 404 ||
        errObj.message?.includes("not a valid FCM registration token") ||
        errObj.message?.includes("Requested entity was not found")
      ) {
        try {
          await prisma.pushSubscription.deleteMany({ where: { token } });
          console.log(`[FCM] Cleaned up stale token: ${token.slice(0, 10)}...`);
        } catch (_) {}
      }

      return { success: false, error: errObj.message };
    }

    return { success: true, name: res.name };
  } catch (err) {
    console.error("[FCM] Exception while sending push notification:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notifies all registered administrators when a new customer order is placed
 */
export async function notifyAdminsNewOrder(order) {
  try {
    const adminSubs = await prisma.pushSubscription.findMany({
      where: { role: "ADMIN" },
      select: { token: true },
    });

    if (!adminSubs.length) {
      console.log("[FCM] No admin devices registered for push notifications");
      return;
    }

    const title = `🔔 Nouvelle commande #${order.dailyNumber || order.reference}`;
    const fulfillmentText = order.fulfillment === "DELIVERY" ? "Livraison" : "À emporter";
    const body = `${order.customerName || "Un client"} a commandé pour ${order.total} DZD (${fulfillmentText})`;
    const url = `/Admin?tab=orders&ref=${order.reference}`;

    const uniqueTokens = [...new Set(adminSubs.map((s) => s.token))];
    const promises = uniqueTokens.map((tok) =>
      sendFcmMessage({
        token: tok,
        title,
        body,
        url,
        data: {
          type: "NEW_ORDER",
          reference: order.reference,
          dailyNumber: String(order.dailyNumber || ""),
          total: String(order.total),
          fulfillment: String(order.fulfillment),
        },
      })
    );

    await Promise.allSettled(promises);
    console.log(`[FCM] Sent new order notification to ${uniqueTokens.length} admin device(s)`);
  } catch (err) {
    console.warn("[FCM] notifyAdminsNewOrder error:", err.message);
  }
}

/**
 * Notifies the customer when their order status updates
 */
export async function notifyCustomerOrderStatus(reference, newStatus, statusLabel = "", fulfillment = null) {
  try {
    const order = await prisma.order.findUnique({
      where: { reference },
      select: { customerPhone: true, fulfillment: true, customerName: true },
    }).catch(() => null);

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
      console.log(`[FCM] No customer device registered for order #${reference}`);
      return;
    }

    const uniqueTokens = [...new Set(subs.map((s) => s.token))];

    let title = "📦 Mise à jour de votre commande";
    let body = `Statut : ${statusLabel || newStatus}`;

    switch (newStatus) {
      case "CONFIRMED":
        title = "✅ Commande confirmée";
        body = `Votre commande #${reference} est confirmée et en attente de préparation.`;
        break;
      case "PREPARING":
        title = "👨‍🍳 En préparation";
        body = `Nos cuisiniers préparent actuellement votre commande #${reference} !`;
        break;
      case "READY":
        title = isDelivery ? "🛵 En attente de livraison" : "✨ Commande prête";
        body = isDelivery
          ? `Votre commande #${reference} est prête et en attente du livreur !`
          : `Votre commande #${reference} est prête à être récupérée au restaurant !`;
        break;
      case "OUT_FOR_DELIVERY":
        title = "🛵 En cours de livraison";
        body = `Le livreur est en route avec votre commande #${reference} !`;
        break;
      case "COMPLETED":
        title = "🎉 Commande terminée";
        body = `Votre commande #${reference} a été remise avec succès. Bon appétit !`;
        break;
      case "CANCELLED":
        title = "❌ Commande annulée";
        body = `Votre commande #${reference} a été annulée.`;
        break;
    }

    const url = `/Commande?track=${reference}`;

    const promises = uniqueTokens.map((tok) =>
      sendFcmMessage({
        token: tok,
        title,
        body,
        url,
        data: {
          type: "STATUS_CHANGE",
          reference,
          status: newStatus,
          fulfillment: isDelivery ? "DELIVERY" : "PICKUP",
        },
      })
    );

    await Promise.allSettled(promises);
    console.log(`[FCM] Sent status update push to ${uniqueTokens.length} customer device(s) for #${reference}`);
  } catch (err) {
    console.warn("[FCM] notifyCustomerOrderStatus error:", err.message);
  }
}

/**
 * Sends a test push notification to a specific token
 */
export async function sendTestNotification(token) {
  return sendFcmMessage({
    token,
    title: "🔔 Test BlackHousse",
    body: "Vos notifications push sont activées et fonctionnent parfaitement !",
    url: "/Admin",
    data: {
      type: "TEST_NOTIFICATION",
      timestamp: new Date().toISOString(),
    },
  });
}

