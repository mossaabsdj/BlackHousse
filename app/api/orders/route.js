import crypto from "node:crypto";
import { NextResponse, after } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { Redis } from "@upstash/redis";

import { orderRateLimit } from "@/lib/order-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  ORDER_INCLUDE,
  serializeOrder,
} from "@/lib/ordering/orders";
import {
  canonicalPhone,
  generateReference,
  isValidPhone,
} from "@/lib/ordering/security";
import {
  syncOrderCreated,
  notifyAdminsNewOrder,
} from "@/lib/firebase-admin";
import { console } from "node:inspector";

const prisma = new PrismaClient();
const redis = Redis.fromEnv();

export const dynamic = "force-dynamic";

const MAX_QTY = 50;
const MAX_LINES = 40;
const MAX_BODY = 20_000;
const IDEMPOTENCY_LOCK_TTL_SECONDS = 300; // 5 minutes

const fail = (status, code, message, extra = {}) =>
  NextResponse.json(
    { success: false, code, message, ...extra },
    { status }
  );

const ok = (order, status, replayed = false) =>
  NextResponse.json(
    { order: serializeOrder(order) },
    {
      status,
      ...(replayed
        ? { headers: { "Idempotency-Replayed": "true" } }
        : {}),
    }
  );

const sha256 = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");

function getIdempotencyRedisKey(idemKey) {
  return `idempotency:orders:${idemKey}`;
}

/**
 * Acquire an atomic, short-lived Redis lock for this order submission.
 * PostgreSQL's unique idempotencyKey constraint remains the permanent safeguard.
 */
async function acquireOrderLock(idemKey) {
  const key = getIdempotencyRedisKey(idemKey);
  const token = crypto.randomUUID();

  const result = await redis.set(key, token, {
    nx: true,
    ex: IDEMPOTENCY_LOCK_TTL_SECONDS,
  });

  return {
    key,
    token,
    acquired: result === "OK",
  };
}

/** Release only if this request still owns the lock. */
async function releaseOrderLock(lock) {
  if (!lock?.key || !lock?.token) return;

  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end
    return 0
  `;

  await redis.eval(script, [lock.key], [lock.token]);
}

function handleExistingOrder(existingOrder, requestHash) {
  if (existingOrder.requestHash !== requestHash) {
    return fail(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "This Idempotency-Key was used with a different order."
    );
  }

  return ok(existingOrder, 200, true);
}

export async function POST(request) {
  try {
    // 1. Validate the idempotency key before doing order work.
    const idemKey = request.headers.get("idempotency-key");
console.log("idemKey", idemKey);
    if (!idemKey || !/^[\w-]{8,100}$/.test(idemKey)) {
      return fail(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Key header is required"
      );
    }

    // 2. Parse request body.
    let body;

    try {
      const raw = await request.text();

      if (raw.length > MAX_BODY) {
        return fail(413, "PAYLOAD_TOO_LARGE", "Payload too large");
      }

      body = JSON.parse(raw);
    } catch {
      return fail(400, "INVALID_JSON", "Invalid JSON");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail(400, "INVALID_BODY", "Invalid request body");
    }

    // 3. Validate customer and fulfillment.
    const fields = {};

    const name = String(body?.customer?.name ?? "").trim();

    if (name.length < 2 || name.length > 80) {
      fields.name = "invalid";
    }

    const phone = canonicalPhone(body?.customer?.phone);

    if (!isValidPhone(phone)) {
      fields.phone = "invalid";
    }

    const fulfillment =
      body?.fulfillment === "delivery"
        ? "DELIVERY"
        : body?.fulfillment === "pickup"
          ? "PICKUP"
          : null;

    if (!fulfillment) {
      fields.fulfillment = "invalid";
    }

    const notes = String(body?.notes ?? "").trim().slice(0, 300);

    let municipality = null;
    let municipalityName = null;
    let address = null;
    let deliveryFee = 0;

    if (fulfillment === "DELIVERY") {
      address = String(body?.delivery?.address ?? "").trim();

      if (address.length < 5 || address.length > 300) {
        fields.address = "invalid";
      }

      const hasList =
        (await prisma.municipality.count({
          where: { isActive: true },
        })) > 0;

      if (hasList) {
        municipality = await prisma.municipality.findFirst({
          where: {
            id: String(body?.delivery?.municipalityId ?? ""),
            isActive: true,
          },
        });

        if (!municipality) {
          fields.municipality = "invalid";
        } else {
          municipalityName = municipality.name;
          deliveryFee = Number(municipality.deliveryFee ?? 0);
        }
      } else {
        const text = String(
          body?.delivery?.municipality ?? ""
        ).trim();

        if (text.length < 2 || text.length > 80) {
          fields.municipality = "invalid";
        } else {
          municipalityName = text;
        }
      }
    }

    // 4. Validate order items.
    const rawItems = Array.isArray(body?.items) ? body.items : [];

    if (rawItems.length < 1 || rawItems.length > MAX_LINES) {
      return fail(422, "INVALID_ITEMS", "Invalid items", { fields });
    }

    const items = [];

    for (const item of rawItems) {
      const quantity = Number(item?.quantity);

      if (
        typeof item?.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_QTY
      ) {
        return fail(422, "INVALID_ITEMS", "Invalid items", { fields });
      }

      const options = [];

      for (const selection of Array.isArray(item.options) ? item.options : []) {
        if (
          typeof selection?.groupId !== "string" ||
          !Array.isArray(selection.optionIds) ||
          selection.optionIds.some((id) => typeof id !== "string")
        ) {
          return fail(422, "INVALID_OPTION", "Invalid options", { fields });
        }

        options.push({
          groupId: selection.groupId,
          optionIds: [...selection.optionIds].sort(),
        });
      }

      items.push({
        productId: item.productId,
        quantity,
        options: options.sort((a, b) => a.groupId.localeCompare(b.groupId)),
      });
    }

    if (Object.keys(fields).length > 0) {
      return fail(422, "VALIDATION_ERROR", "Validation failed", { fields });
    }

    // 5. Generate a stable hash for the normalized order payload.
    const requestHash = sha256({
      customer: { name, phone },
      fulfillment,
      delivery:
        fulfillment === "DELIVERY"
          ? {
              municipalityId: municipality?.id ?? null,
              municipalityName,
              address,
            }
          : null,
      notes,
      items,
    });

    // 6. Check PostgreSQL first. It is the permanent source of truth.
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: idemKey },
      include: ORDER_INCLUDE,
    });

    if (existing) {
      return handleExistingOrder(existing, requestHash);
    }

    // 7. Try to acquire the Redis lock.
    // If Redis locking is unavailable, continue: PostgreSQL's unique constraint
    // still prevents a second order from being committed with this key.
    let orderLock = null;

    try {
      orderLock = await acquireOrderLock(idemKey);
    } catch (error) {
      console.error("[orders] Redis idempotency lock unavailable:", error);
    }

    if (orderLock && !orderLock.acquired) {
      // The first request may have committed just before this second lookup.
      const duplicate = await prisma.order.findUnique({
        where: { idempotencyKey: idemKey },
        include: ORDER_INCLUDE,
      });

      if (duplicate) {
        return handleExistingOrder(duplicate, requestHash);
      }

      return fail(
        409,
        "ORDER_PROCESSING",
        "This order is already being processed. Please try again shortly.",
        { retryAfter: 2 }
      );
    }

    // Always release a lock acquired by this request, including on early returns.
    try {
      // 8. Rate limit only new order-creation attempts.
      // Completed idempotent replays above do not consume another rate-limit slot.
      const ip = getClientIp(request) || "127.0.0.1";

      let rateLimitResult;

      try {
        rateLimitResult = await orderRateLimit.limit(ip);
      } catch (error) {
        console.error("Order rate limiter unavailable:", error);
        return fail(
          503,
          "SERVICE_UNAVAILABLE",
          "Order service temporarily unavailable."
        );
      }

      if (!rateLimitResult.success) {
        const retryAfter = Math.max(
          1,
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );

        return NextResponse.json(
          {
            success: false,
            code: "RATE_LIMITED",
            message: "Too many order requests. Please try again later.",
            retryAfter,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          }
        );
      }

      // 9. Fetch products and calculate prices on the server.
      const products = await prisma.product.findMany({
        where: {
          id: {
            in: [...new Set(items.map((item) => item.productId))],
          },
          isActive: true,
        },
        include: {
          optionGroups: {
            include: {
              group: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      });

      const byId = new Map(products.map((product) => [product.id, product]));

      const lines = [];
      const unavailable = [];

      for (const item of items) {
        const product = byId.get(item.productId);

        if (!product || !product.available) {
          unavailable.push(item.productId);
          continue;
        }

        const groups = new Map(
          product.optionGroups.map((pg) => [pg.group.id, pg.group])
        );

        const picked = new Map();

        for (const selection of item.options) {
          const unique = new Set(selection.optionIds);

          if (
            !groups.has(selection.groupId) ||
            picked.has(selection.groupId) ||
            unique.size !== selection.optionIds.length
          ) {
            return fail(422, "INVALID_OPTION", "Invalid options");
          }

          picked.set(selection.groupId, unique);
        }

        let unitPrice = Number(product.price);
        const optionRows = [];

        for (const group of groups.values()) {
          const ids = picked.get(group.id) ?? new Set();
          const single = group.selection === "SINGLE";

          const min = single
            ? group.required
              ? 1
              : 0
            : Math.max(
                Number(group.minSelect ?? 0),
                group.required ? 1 : 0
              );

          const max = single ? 1 : group.maxSelect ?? Infinity;

          if (ids.size < min || ids.size > max) {
            return fail(
              422,
              "INVALID_OPTION",
              `Invalid selection for "${group.name}"`
            );
          }

          for (const optionId of ids) {
            const option = group.options.find(
              (candidate) => candidate.id === optionId && candidate.isActive
            );

            if (!option) {
              return fail(422, "INVALID_OPTION", "Unknown option");
            }

            if (!option.available) {
              unavailable.push(product.id);
              continue;
            }

            const optionPrice = Number(option.price);
            unitPrice += optionPrice;

            optionRows.push({
              groupName: group.name,
              optionName: option.name,
              price: optionPrice,
            });
          }
        }

        lines.push({
          productId: product.id,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          lineTotal: unitPrice * item.quantity,
          options: optionRows,
        });
      }

      if (unavailable.length > 0) {
        return fail(
          409,
          "PRODUCT_UNAVAILABLE",
          "A product is no longer available",
          { unavailable: [...new Set(unavailable)] }
        );
      }

      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

      if (
        body.expectedSubtotal !== undefined &&
        body.expectedSubtotal !== null &&
        body.expectedSubtotal !== "" &&
        (
          !Number.isFinite(Number(body.expectedSubtotal)) ||
          Number(body.expectedSubtotal) !== subtotal
        )
      ) {
        return fail(409, "PRICE_CHANGED", "Prices have changed", { subtotal });
      }

      // 10. Create the order, retrying unique-reference collisions.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const todayKey = new Date().toISOString().slice(0, 10);

          const startOfDay = new Date(`${todayKey}T00:00:00.000Z`);
          const endOfDay = new Date(`${todayKey}T23:59:59.999Z`);

          const todayCount = await prisma.order.count({
            where: {
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          const dailyNumber = todayCount + 1;

          const order = await prisma.order.create({
            data: {
              reference: generateReference(),
              status: "PENDING",
              fulfillment,
              customerName: name,
              customerPhone: phone,
              municipalityId: municipality?.id ?? null,
              municipalityName,
              address,
              notes: notes || null,
              subtotal,
              deliveryFee,
              total: subtotal + deliveryFee,
              idempotencyKey: idemKey,
              requestHash,

              items: {
                create: lines.map((line) => ({
                  productId: line.productId,
                  productName: line.productName,
                  unitPrice: line.unitPrice,
                  quantity: line.quantity,
                  lineTotal: line.lineTotal,
                  options: {
                    create: line.options,
                  },
                })),
              },

              history: {
                create: {
                  status: "PENDING",
                },
              },
            },
            include: ORDER_INCLUDE,
          });

          // This number is added to the response object only; it is not persisted.
          const responseOrder = {
            ...order,
            dailyNumber,
          };

          // Run Firebase synchronization and admin notification after the response.
          // These are scheduled only for a newly created order, never for a replay.
          after(async () => {
            try {
              await syncOrderCreated(responseOrder);
            } catch (error) {
              console.warn(
                "[orders] Firebase sync error:",
                error?.message ?? error
              );
            }

            try {
              await notifyAdminsNewOrder(responseOrder);
            } catch (error) {
              console.warn(
                "[orders] Admin push error:",
                error?.message ?? error
              );
            }
          });

          if (
            body.fcmToken &&
            typeof body.fcmToken === "string" &&
            body.fcmToken.trim().length > 10
          ) {
            try {
              await prisma.pushSubscription.upsert({
                where: { token: body.fcmToken.trim() },
                create: {
                  token: body.fcmToken.trim(),
                  role: "CLIENT",
                  orderReference: responseOrder.reference,
                  customerPhone: responseOrder.customerPhone,
                },
                update: {
                  orderReference: responseOrder.reference,
                  customerPhone: responseOrder.customerPhone,
                  updatedAt: new Date(),
                },
              });

              console.log(
                `[orders] Linked FCM token to order #${responseOrder.reference}`
              );
            } catch (err) {
              console.warn(
                "[orders] FCM token registration error:",
                err.message
              );
            }
          }

          return ok(responseOrder, 201);
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            const target = String(error.meta?.target ?? "");

            if (target.includes("idempotencyKey")) {
              const duplicate = await prisma.order.findUnique({
                where: { idempotencyKey: idemKey },
                include: ORDER_INCLUDE,
              });

              return duplicate
                ? handleExistingOrder(duplicate, requestHash)
                : fail(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "The order key already exists. Please retry with the same key."
                  );
            }

            // Retry other unique-constraint collisions (for example reference).
            if (attempt < 4) {
              continue;
            }
          }

          throw error;
        }
      }

      return fail(500, "SERVER_ERROR", "Could not create the order");
    } finally {
      if (orderLock?.acquired) {
        try {
          await releaseOrderLock(orderLock);
        } catch (error) {
          // The lock has a TTL, so a failed release will not leave it forever.
          console.error("[orders] Failed to release Redis idempotency lock:", error);
        }
      }
    }
  } catch (error) {
    console.error("[orders] POST failed:", error);

    return fail(
      500,
      "SERVER_ERROR",
      "Could not process the order"
    );
  }
}