import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/unsubscribe
 * Removes an FCM push token registration
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || !body.token || typeof body.token !== "string") {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Token FCM manquant." },
        { status: 400 }
      );
    }

    const token = body.token.trim();

    await prisma.pushSubscription.deleteMany({
      where: { token },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notifications/unsubscribe] Error:", error);
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Impossible de supprimer la souscription push." },
      { status: 500 }
    );
  }
}

