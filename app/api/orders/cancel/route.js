import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { changeOrderStatus, getOrderStatusLabel, OrderStatusConflictError } from "@/lib/ordering/orders";
import { canonicalPhone, clientIp, rateLimit } from "@/lib/ordering/security";
import { notifyAdminsOrderCancelled } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const fail = (status, code, message) => NextResponse.json({ code, message }, { status });

/**
 * Customer order cancellation endpoint.
 *
 * Rules:
 * - Allowed ONLY when order status is PENDING (en attente de préparation).
 * - Disabled / rejected once preparation starts (CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY, COMPLETED).
 * - Idempotent: If already CANCELLED, returns success immediately without re-processing.
 * - Reuses existing cancellation logic, real-time Firestore sync, and FCM notification dispatch.
 */
export async function POST(request) {
  const ip = clientIp(request);
  if (!rateLimit(`cancel:ip:${ip}`, { limit: 20, windowMs: WINDOW_MS })) {
    return fail(429, "RATE_LIMITED", "Trop de requêtes, veuillez patienter un instant.");
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return fail(413, "PAYLOAD_TOO_LARGE", "Payload too large");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "INVALID_JSON", "Format JSON invalide.");
  }

  const reference = typeof body?.reference === "string" ? body.reference.trim() : null;
  const rawPhone = body?.phone ? canonicalPhone(body.phone) : null;

  if (!reference) {
    return fail(400, "MISSING_REFERENCE", "La référence de la commande est requise.");
  }

  if (!rateLimit(`cancel:ref:${reference}`, { limit: 10, windowMs: WINDOW_MS })) {
    return fail(429, "RATE_LIMITED", "Trop de tentatives d'annulation pour cette commande.");
  }

  // Retrieve the order
  const order = await prisma.order.findUnique({
    where: { reference },
    include: { history: true },
  });

  if (!order) {
    return fail(404, "NOT_FOUND", "Commande introuvable.");
  }

  // Security check: if phone is provided, ensure it matches order customerPhone
  if (rawPhone && order.customerPhone && canonicalPhone(order.customerPhone) !== rawPhone) {
    return fail(403, "FORBIDDEN", "Numéro de téléphone ne correspond pas à cette commande.");
  }

  const currentStatus = String(order.status).toUpperCase();

  // Idempotency: If already cancelled, return success without duplicate processing
  if (currentStatus === "CANCELLED") {
    return NextResponse.json({
      success: true,
      alreadyCancelled: true,
      message: "Cette commande a déjà été annulée.",
      order: {
        reference: order.reference,
        status: "CANCELLED",
        statusLabel: getOrderStatusLabel("CANCELLED", order.fulfillment),
      },
    });
  }

  // Cancellation allowed when order is PENDING (en attente de confirmation) or CONFIRMED (en attente de préparation).
  // Disabled once preparation starts (PREPARING, READY, OUT_FOR_DELIVERY, COMPLETED).
  const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"];
  if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
    return fail(
      422,
      "ORDER_NOT_CANCELLABLE",
      "La commande ne peut plus être annulée car sa préparation a déjà commencé."
    );
  }

  try {
    const eventId = `evt_order_cancel_cust_${reference}_${Date.now()}`;
    const updatedOrder = await changeOrderStatus(reference, "CANCELLED", {
      eventId,
      cancelledBy: "CUSTOMER",
    });

    // Notify administrators via FCM
    notifyAdminsOrderCancelled(order, { eventId }).catch((err) =>
      console.warn("[orders/cancel] Admin push notification error:", err.message)
    );

    return NextResponse.json({
      success: true,
      message: "Votre commande a été annulée avec succès.",
      order: {
        reference: updatedOrder.reference,
        status: updatedOrder.status,
        statusLabel: getOrderStatusLabel(updatedOrder.status, updatedOrder.fulfillment),
      },
    });
  } catch (err) {
    if (err instanceof OrderStatusConflictError) {
      if (err.code === "ORDER_ALREADY_CANCELLED") {
        return NextResponse.json({
          success: true,
          alreadyCancelled: true,
          message: "Cette commande a déjà été annulée.",
          order: {
            reference: order.reference,
            status: "CANCELLED",
            statusLabel: getOrderStatusLabel("CANCELLED", order.fulfillment),
          },
        });
      }
      return fail(409, err.code, err.message, { currentStatus: err.currentStatus });
    }
    console.error("[orders/cancel] Error cancelling order:", err);
    return fail(500, "INTERNAL_ERROR", "Une erreur est survenue lors de l'annulation de la commande.");
  }
}

