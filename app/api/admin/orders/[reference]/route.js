import { admin, HttpError, json, parse } from "@/lib/admin/http";
import {
  STATUS_LABELS,
  getOrderStatusLabel,
  changeOrderStatus,
  OrderStatusConflictError,
} from "@/lib/ordering/orders";

export const dynamic = "force-dynamic";

// PATCH /api/admin/orders/BH-261015-K7Q2M  { status: "PREPARING", expectedStatus?: "CONFIRMED" }
// Atomically verifies current status and writes the status history with row-level locking.
export const PATCH = admin(async ({ params, body }) => {
  const { status, expectedStatus } = parse(body, {
    status: { type: "enum", values: Object.keys(STATUS_LABELS) },
    expectedStatus: { type: "enum", values: Object.keys(STATUS_LABELS), required: false },
  });

  try {
    const updatedOrder = await changeOrderStatus(params.reference, status, {
      expectedStatus,
      cancelledBy: "ADMIN",
    });

    return json({
      item: {
        reference: updatedOrder.reference,
        status: updatedOrder.status,
        statusLabel: getOrderStatusLabel(updatedOrder.status, updatedOrder.fulfillment),
      },
    });
  } catch (err) {
    if (err instanceof OrderStatusConflictError) {
      throw new HttpError(409, err.code, err.message, {
        currentStatus: err.currentStatus,
      });
    }
    throw err;
  }
});
