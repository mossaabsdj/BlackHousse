import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sendTestNotification, sendFcmMessage } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/test
 * Admin-only test endpoint to trigger a sample push notification
 */
export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Accès réservé aux administrateurs." },
        { status: auth.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const targetToken = body?.token;

    if (!targetToken || typeof targetToken !== "string") {
      return NextResponse.json(
        { code: "MISSING_TOKEN", message: "Token FCM de destination manquant." },
        { status: 400 }
      );
    }

    const result = await sendTestNotification(targetToken);

    if (!result.success) {
      return NextResponse.json(
        { code: "DELIVERY_FAILED", message: result.error || "Échec de l'envoi de la notification." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[notifications/test] Error:", error);
    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Erreur lors de l'envoi du test." },
      { status: 500 }
    );
  }
}

