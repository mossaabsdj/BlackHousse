import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFeedbackCreated } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

/**
 * Calculates overall rating statistics across ALL valid feedbacks in DB,
 * regardless of whether their comments are APPROVED, PENDING, or REJECTED.
 */
async function computeOverallStats() {
  const [total, aggregate, distGroup] = await Promise.all([
    prisma.feedback.count(),
    prisma.feedback.aggregate({
      _avg: { rating: true },
    }),
    prisma.feedback.groupBy({
      by: ["rating"],
      _count: { rating: true },
    }),
  ]);

  const rawAvg = aggregate._avg.rating || 0;
  const avg = Number(rawAvg.toFixed(1));

  const distMap = new Map();
  for (const row of distGroup) {
    distMap.set(row.rating, row._count.rating);
  }

  const dist = [5, 4, 3, 2, 1].map((stars) => {
    const count = distMap.get(stars) || 0;
    const pct = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
    return { stars, count, pct };
  });

  return { total, avg, dist };
}

function formatDateFr(date) {
  if (!date) return "";
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 2) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// GET /api/feedback
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic");

    const stats = await computeOverallStats();

    // Query approved feedback with comments for public display
    const where = {
      status: "APPROVED",
      comment: { not: null },
    };

    if (topic) {
      where.topics = { has: topic };
    }

    const rows = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const items = rows
      .filter((r) => r.comment && r.comment.trim().length > 0)
      .map((r) => ({
        id: r.id,
        name: r.name || "Client",
        rating: r.rating,
        date: formatDateFr(r.createdAt),
        rawDate: r.createdAt.toISOString(),
        topics: r.topics || [],
        comment: r.comment,
      }));

    return NextResponse.json(
      {
        success: true,
        stats,
        items,
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err) {
    console.error("[api/feedback GET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les avis" },
      { status: 500 }
    );
  }
}

// POST /api/feedback
export async function POST(request) {
  try {
    const raw = await request.text();
    if (!raw) {
      return NextResponse.json({ error: "Corps de requête manquant" }, { status: 400 });
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La note doit être un nombre entier entre 1 et 5." },
        { status: 422 }
      );
    }

    const name = typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : "Client";

    const comment = typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim().slice(0, 400)
      : null;

    let topics = [];
    if (Array.isArray(body.topics)) {
      topics = body.topics
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .slice(0, 10);
    }

    // Customer comments require admin approval before being shown publicly.
    // If there is no comment (only a rating), we can keep it PENDING or APPROVED,
    // but customer overall ratings count in either case.
    const created = await prisma.feedback.create({
      data: {
        name,
        rating,
        topics,
        comment,
        status: "PENDING",
      },
    });

    // Notify admin via Firebase in real-time
    await syncFeedbackCreated(created);

    // Compute updated stats across all ratings
    const stats = await computeOverallStats();

    return NextResponse.json(
      {
        success: true,
        message: comment
          ? "Merci pour votre avis ! Votre note a été enregistrée et votre commentaire sera visible après modération."
          : "Merci pour votre note !",
        item: {
          id: created.id,
          name: created.name,
          rating: created.rating,
          date: formatDateFr(created.createdAt),
          topics: created.topics,
          comment: created.comment,
          status: created.status,
        },
        stats,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/feedback POST] Error:", err);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'enregistrement de l'avis." },
      { status: 500 }
    );
  }
}

