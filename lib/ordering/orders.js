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

/** Use this from your admin dashboard to move an order forward (also writes the history). */
export async function changeOrderStatus(reference, status, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) throw new Error("Invalid status");
  const { order, historyRecord } = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({ where: { reference }, data: { status } });
    const h = await tx.orderStatusHistory.create({ data: { orderId: o.id, status } });
    return { order: o, historyRecord: h };
  });

  const label = getOrderStatusLabel(status, order.fulfillment);
  const eventId = options.eventId || `evt_order_status_${historyRecord.id}`;
 notifyCustomerOrderStatus(reference, status, label, order.fulfillment, {
    eventId,
  }).catch((err) =>
    console.warn("[orders] Customer FCM push notification error:", err.message)
  );
  // Synchronize status change to Firebase in real-time
  syncOrderStatus(reference, status, label, {
    eventId,
    fulfillment: order.fulfillment,
  }).catch((err) =>
    console.warn("[orders] Firebase status sync error:", err.message)
  );
console.log("notify custmer")
  // Send push notification to customer devices
 

  return order;
}
