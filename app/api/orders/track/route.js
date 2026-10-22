import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { serializeTracking } from "@/lib/ordering/orders";
import { canonicalPhone, clientIp, isValidPhone, rateLimit } from "@/lib/ordering/security";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
// Only recent orders can be looked up by phone number (limits what a stranger could ever see).
const RECENT_HOURS = Number(process.env.TRACK_WINDOW_HOURS) || 48;

const fail = (status, code, message) => NextResponse.json({ code, message }, { status });

/**
 * Tracking by phone number only.
 * Returns, for that number's recent orders, ONLY: customer full name + status + time(s).
 */
export async function POST(request) {
  if (!rateLimit(`track:ip:${clientIp(request)}`, { limit: 30, windowMs: WINDOW_MS })) return fail(429, "RATE_LIMITED", "Too many requests");

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return fail(413, "PAYLOAD_TOO_LARGE", "Payload too large");
    body = JSON.parse(raw);
  } catch {
    return fail(400, "INVALID_JSON", "Invalid JSON");
  }

  const phone = canonicalPhone(body?.phone);
  if (!isValidPhone(phone)) return fail(400, "INVALID_PHONE", "Invalid phone number");
  if (!rateLimit(`track:phone:${phone}`, { limit: 15, windowMs: WINDOW_MS })) return fail(429, "RATE_LIMITED", "Too many requests");

  const orders = await prisma.order.findMany({
    where: {
      customerPhone: phone,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      createdAt: { gte: new Date(Date.now() - RECENT_HOURS * 3600 * 1000) },
    },
    include: { history: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ orders: orders.map(serializeTracking) }, { headers: { "Cache-Control": "no-store" } });
}