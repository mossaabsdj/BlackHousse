import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { syncOrderStatus, notifyCustomerOrderStatus } from "../firebase-admin.js";

// Labels shown to customers. Keep in sync with the OrderStatus enum.
export const STATUS_LABELS = {
  PENDING: "En attente de confirmation",
  CONFIRMED: "En attente de préparation",
  PREPARING: "En préparation",
  READY: "Prête",
  OUT_FOR_DELIVERY: "En cours de livraison",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

/**
 * Returns dynamic contextual label depending on fulfillment (Delivery vs Pickup)
 */
export function getOrderStatusLabel(status, fulfillment = null) {
  const isDelivery = String(fulfillment).toUpperCase() === "DELIVERY";
  if (status === "READY") {
    return isDelivery ? "En attente de livraison" : "En attente de retrait";
  }
  if (status === "CONFIRMED") {
    return "En attente de préparation";
  }
  return STATUS_LABELS[status] ?? status;
}

export const ORDER_INCLUDE = {
  items: { include: { options: true }, orderBy: { id: "asc" } },
  history: { orderBy: { createdAt: "asc" } },
};

/** Full order, returned ONLY to the customer who just created it (POST /api/orders). */
export function serializeOrder(o) {
  const delivery = o.fulfillment === "DELIVERY";
  return {
    reference: o.reference,
    dailyNumber: o.dailyNumber ?? null,
    status: o.status,
    statusLabel: getOrderStatusLabel(o.status, o.fulfillment),
    statusHistory: (o.history ?? []).map((h) => ({
      status: h.status,
      label: getOrderStatusLabel(h.status, o.fulfillment),
      at: h.createdAt.toISOString(),
    })),
    createdAt: o.createdAt.toISOString(),
    fulfillment: delivery ? "delivery" : "pickup",
    delivery: delivery ? { municipality: o.municipalityName ?? "", address: o.address ?? "" } : null,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    items: o.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      options: i.options.map((x) => x.optionName),
      total: i.lineTotal,
    })),
  };
}

/**
 * Customer tracking view: reference + status + time + full order details (items, options, pricing).
 */
export function serializeTracking(o) {
  const isDelivery = o.fulfillment === "DELIVERY";
  const statusHistory = (o.history ?? []).map((h) => ({
    status: h.status,
    label: getOrderStatusLabel(h.status, o.fulfillment),
    at: h.createdAt.toISOString(),
  }));
  return {
    reference: o.reference,
    dailyNumber: o.dailyNumber ?? null,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    fulfillment: isDelivery ? "delivery" : "pickup",
    delivery: isDelivery
      ? { municipality: o.municipalityName ?? "", address: o.address ?? "" }
      : null,
    status: o.status,
    statusLabel: getOrderStatusLabel(o.status, o.fulfillment),
    updatedAt: statusHistory.length ? statusHistory[statusHistory.length - 1].at : o.updatedAt.toISOString(),
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
    statusHistory,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    notes: o.notes || null,
    items: (o.items ?? []).map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      options: (i.options ?? []).map((x) => x.optionName),
      total: i.lineTotal,
    })),
  };
}

export class OrderStatusConflictError extends Error {
  constructor(code, message, currentStatus = null, currentOrder = null) {
    super(message);
    this.name = "OrderStatusConflictError";
    this.code = code;
    this.status = 409;
    this.currentStatus = currentStatus;
    this.currentOrder = currentOrder;
  }
}

/**
 * Valid state transitions for orders.
 * CANCELLED and COMPLETED are strict terminal states (no transitions allowed out).
 */
export const VALID_STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "PREPARING", "CANCELLED"],
  CONFIRMED: ["PREPARING", "PENDING", "CANCELLED"],
  PREPARING: ["READY", "CONFIRMED", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED", "PREPARING", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "READY", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Atomically transitions an order to a new status with row-level database locking.
 * Prevents race conditions, duplicate processing, and resurrection of cancelled orders.
 */
export async function changeOrderStatus(reference, status, options = {}) {
  if (!reference) throw new Error("Reference is required");
  if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const {
    expectedStatus = null,
    cancelledBy = null,
    eventId: customEventId = null,
  } = options;

  const { order, historyRecord, noop } = await prisma.$transaction(async (tx) => {
    // 1. Acquire exclusive row-level lock on the order row
    const lockedRows = await tx.$queryRaw`
      SELECT id, reference, status, fulfillment, "customerPhone", "customerName"
      FROM "Order"
      WHERE reference = ${reference}
      LIMIT 1
      FOR UPDATE
    `;

    if (!lockedRows || lockedRows.length === 0) {
      const err = new Error("Commande introuvable");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    const current = lockedRows[0];
    const currentStatus = String(current.status).toUpperCase();
    const targetStatus = String(status).toUpperCase();

    // 2. Idempotency: If already at target status, return without duplicate side effects
    if (currentStatus === targetStatus) {
      return { order: current, historyRecord: null, noop: true };
    }

    // 3. Strict guard: CANCELLED is an immutable terminal state. Never allow resurrection or updates.
    if (currentStatus === "CANCELLED") {
      throw new OrderStatusConflictError(
        "ORDER_ALREADY_CANCELLED",
        "Cette commande a déjà été annulée et ne peut plus être modifiée.",
        currentStatus,
        current
      );
    }

    // 4. Strict guard: COMPLETED is an immutable terminal state.
    if (currentStatus === "COMPLETED") {
      throw new OrderStatusConflictError(
        "ORDER_ALREADY_COMPLETED",
        "Cette commande est déjà terminée et ne peut plus être modifiée.",
        currentStatus,
        current
      );
    }

    // 5. Atomic expectedStatus check: reject if the order status changed behind the caller's back
    if (expectedStatus) {
      const expectedArr = Array.isArray(expectedStatus)
        ? expectedStatus.map((s) => String(s).toUpperCase())
        : [String(expectedStatus).toUpperCase()];
      if (!expectedArr.includes(currentStatus)) {
        throw new OrderStatusConflictError(
          "ORDER_STATUS_CONFLICT",
          `Conflit de statut : la commande est passée à « ${getOrderStatusLabel(currentStatus, current.fulfillment)} ».`,
          currentStatus,
          current
        );
      }
    }

    // 6. Customer cancellation check: permitted only when PENDING or CONFIRMED (before preparation begins)
    if (cancelledBy === "CUSTOMER") {
      const CANCELLABLE_BY_CUSTOMER = ["PENDING", "CONFIRMED"];
      if (!CANCELLABLE_BY_CUSTOMER.includes(currentStatus)) {
        throw new OrderStatusConflictError(
          "ORDER_NOT_CANCELLABLE",
          "La commande ne peut plus être annulée car sa préparation a déjà commencé.",
          currentStatus,
          current
        );
      }
    }

    // 7. Validate fulfillment constraints
    if (String(current.fulfillment).toUpperCase() === "PICKUP" && targetStatus === "OUT_FOR_DELIVERY") {
      throw new OrderStatusConflictError(
        "INVALID_FULFILLMENT_STATUS",
        "Cette commande est à retirer au restaurant (pas de livraison).",
        currentStatus,
        current
      );
    }

    // 8. Validate allowed state machine transitions
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new OrderStatusConflictError(
        "INVALID_STATUS_TRANSITION",
        `Transition non autorisée de « ${getOrderStatusLabel(currentStatus, current.fulfillment)} » vers « ${getOrderStatusLabel(targetStatus, current.fulfillment)} ».`,
        currentStatus,
        current
      );
    }

    // 9. Atomically update order and record history
    const updated = await tx.order.update({
      where: { reference },
      data: { status: targetStatus },
    });

    const history = await tx.orderStatusHistory.create({
      data: {
        orderId: current.id,
        status: targetStatus,
      },
    });

    return { order: updated, historyRecord: history, noop: false };
  });

  if (noop) {
    return order;
  }

  const label = getOrderStatusLabel(status, order.fulfillment);
  const eventId = customEventId || `evt_order_status_${historyRecord.id}`;

  // Notify customer devices via FCM with multilingual push
  await notifyCustomerOrderStatus(reference, status, label, order.fulfillment, {
    eventId,
  }).catch((err) =>
    console.warn("[orders] Customer FCM push notification error:", err.message)
  );

  // Synchronize status change to Firebase Firestore in real-time
  await syncOrderStatus(reference, status, label, {
    eventId,
    fulfillment: order.fulfillment,
  }).catch((err) =>
    console.warn("[orders] Firebase status sync error:", err.message)
  );

  return order;
}
