import { prisma } from "@/lib/prisma";
import { admin, json, parse, HttpError } from "@/lib/admin/http";
import { syncFeedbackStatus } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// PATCH /api/admin/feedback/[id] - Approve or Reject
export const PATCH = admin(async ({ params, body }) => {
  const { id } = params;
  if (!id) throw new HttpError(400, "MISSING_ID", "ID manquant");

  const data = parse(body, {
    status: { type: "enum", values: ["APPROVED", "REJECTED", "PENDING"], required: true },
  });

  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Avis introuvable");
  }

  const updated = await prisma.feedback.update({
    where: { id },
    data: { status: data.status },
  });

  const eventId = `evt_feedback_status_${id}_${data.status}_${new Date(updated.updatedAt).getTime()}`;

  // Sync to Firebase with stable eventId
  await syncFeedbackStatus(id, data.status, { eventId });

  return json({
    success: true,
    item: {
      id: updated.id,
      name: updated.name,
      rating: updated.rating,
      comment: updated.comment,
      topics: updated.topics,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

// DELETE /api/admin/feedback/[id]
export const DELETE = admin(async ({ params }) => {
  const { id } = params;
  if (!id) throw new HttpError(400, "MISSING_ID", "ID manquant");

  await prisma.feedback.delete({ where: { id } });

  return json({ success: true, id });
});

