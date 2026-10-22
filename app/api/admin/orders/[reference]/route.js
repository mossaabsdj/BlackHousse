import { prisma } from "@/lib/prisma";
import { admin, HttpError, json, parse } from "@/lib/admin/http";
import { STATUS_LABELS, getOrderStatusLabel, changeOrderStatus } from "@/lib/ordering/orders";

export const dynamic = "force-dynamic";

// PATCH /api/admin/orders/BH-261015-K7Q2M  { status: "PREPARING" }
// Writes the status history too: that is what customers see (with the time) when they track their order.
export const PATCH = admin(async ({ params, body }) => {
  const { status } = parse(body, { status: { type: "enum", values: Object.keys(STATUS_LABELS) } });
  const order = await prisma.order.findUnique({ where: { reference: params.reference } });
  if (!order) throw new HttpError(404, "NOT_FOUND", "Commande introuvable");
  if (order.fulfillment === "PICKUP" && status === "OUT_FOR_DELIVERY")
    throw new HttpError(422, "VALIDATION_ERROR", "Cette commande est à retirer au restaurant (pas de livraison).", { status: "invalid" });
  if (order.status !== status) await changeOrderStatus(params.reference, status);
  return json({ item: { reference: order.reference, status, statusLabel: getOrderStatusLabel(status, order.fulfillment) } });
});