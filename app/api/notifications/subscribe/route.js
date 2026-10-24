import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/subscribe
 * Registers or updates an FCM push token for an administrator or a customer
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.token || typeof body.token !== "string" || body.token.trim().length < 10) {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Token FCM invalide ou manquant." },
        { status: 400 }
      );
    }

    const token = body.token.trim();
    const requestedRole = body.role === "ADMIN" ? "ADMIN" : "CLIENT";
    let adminEmail = null;

    // Secure admin registration: MUST have valid ADMIN NextAuth JWT
    if (requestedRole === "ADMIN") {
      const auth = await requireAdmin(request);
      if (!auth.ok) {
        return NextResponse.json(
          {
            code: "UNAUTHORIZED",
            message: "Seuls les administrateurs connectés peuvent s'inscrire aux notifications d'administration.",
          },
          { status: auth.status }
        );
      }
      adminEmail = auth.token.email || null;
    }

    const orderReference = typeof body.orderReference === "string" ? body.orderReference.trim() : null;
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : null;
    const userAgent = request.headers.get("user-agent") || null;

    const existing = await prisma.pushSubscription.findUnique({
      where: { token },
      select: { role: true },
    });

    // If device is already registered as ADMIN, do not downgrade to CLIENT if an order is placed on that device
    const effectiveRole =
      existing?.role === "ADMIN" && requestedRole === "CLIENT"
        ? "ADMIN"
        : requestedRole;

    const subscription = await prisma.pushSubscription.upsert({
      where: { token },
      create: {
        token,
        role: effectiveRole,
        adminEmail,
        orderReference,
        customerPhone,
        userAgent,
      },
      update: {
        role: effectiveRole,
        adminEmail: effectiveRole === "ADMIN" ? adminEmail || undefined : undefined,
        orderReference: orderReference || undefined,
        customerPhone: customerPhone || undefined,
        userAgent: userAgent || undefined,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      role: subscription.role,
      orderReference: subscription.orderReference,
    });
  } catch (error) {
    console.error("[notifications/subscribe] Error:", error);
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Impossible d'enregistrer la souscription push." },
      { status: 500 }
    );
  }
}

