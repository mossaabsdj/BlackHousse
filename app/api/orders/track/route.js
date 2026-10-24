import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { serializeTracking, ORDER_INCLUDE } from "@/lib/ordering/orders";
import { canonicalPhone, clientIp, isValidPhone, rateLimit } from "@/lib/ordering/security";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
// Order tracking is strictly limited to orders created within the last 6 hours
const TRACK_WINDOW_HOURS = 6;

const fail = (status, code, message) => NextResponse.json({ code, message }, { status });

/**
 * Public order tracking endpoint.
 * Allows customers to track orders created within the last 6 hours (including active & cancelled orders).
 * Returns complete order details (items, options, pricing, status, and history).
 */
export async function POST(request) {
  if (!rateLimit(`track:ip:${clientIp(request)}`, { limit: 30, windowMs: WINDOW_MS })) {
    return fail(429, "RATE_LIMITED", "Too many requests");
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return fail(413, "PAYLOAD_TOO_LARGE", "Payload too large");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "INVALID_JSON", "Invalid JSON");
  }

  const rawRef = typeof body?.reference === "string" ? body.reference.trim() : null;
  const rawPhone = body?.phone ? canonicalPhone(body.phone) : null;

  if (!rawPhone && !rawRef) {
    return fail(400, "INVALID_REQUEST", "Veuillez fournir un numéro de téléphone ou une référence de commande");
  }

  if (rawPhone && !isValidPhone(rawPhone)) {
    return fail(400, "INVALID_PHONE", "Numéro de téléphone invalide");
  }

  const rateKey = rawPhone ? `track:phone:${rawPhone}` : `track:ref:${rawRef}`;
  if (!rateLimit(rateKey, { limit: 20, windowMs: WINDOW_MS })) {
    return fail(429, "RATE_LIMITED", "Trop de requêtes, veuillez patienter un instant");
  }

  const sixHoursAgo = new Date(Date.now() - TRACK_WINDOW_HOURS * 60 * 60 * 1000);

  // Filter criteria: Orders created within the last 6 hours.
  // Active and Cancelled orders are returned (completed orders are excluded from active tracking).
  const whereClause = {
    createdAt: { gte: sixHoursAgo },
    status: { notIn: ["COMPLETED"] },
    ...(rawPhone ? { customerPhone: rawPhone } : {}),
    ...(rawRef ? { reference: rawRef } : {}),
  };

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json(
    { orders: orders.map(serializeTracking) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
