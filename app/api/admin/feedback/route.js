import { prisma } from "@/lib/prisma";
import { admin, json } from "@/lib/admin/http";

export const dynamic = "force-dynamic";
const DEFAULT_PAGE_SIZE = 15;

// GET /api/admin/feedback?status=PENDING&page=1&pageSize=15&q=burger
export const GET = admin(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const statusParam = (sp.get("status") || "ALL").toUpperCase();
  const ratingParam = sp.get("rating");
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  const where = {};

  if (["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    where.status = statusParam;
  }

  if (ratingParam && !isNaN(Number(ratingParam))) {
    const r = Number(ratingParam);
    if (r >= 1 && r <= 5) {
      where.rating = r;
    }
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { comment: { contains: q, mode: "insensitive" } },
    ];
  }

  const [
    items,
    totalMatching,
    pendingCount,
    approvedCount,
    rejectedCount,
    totalAll,
    overallAgg,
  ] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { status: "PENDING" } }),
    prisma.feedback.count({ where: { status: "APPROVED" } }),
    prisma.feedback.count({ where: { status: "REJECTED" } }),
    prisma.feedback.count(),
    prisma.feedback.aggregate({
      _avg: { rating: true },
    }),
  ]);

  const rawAvg = overallAgg._avg.rating || 0;

  return json({
    items: items.map((r) => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      topics: r.topics,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total: totalMatching,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalMatching / pageSize)),
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      total: totalAll,
    },
    overallStats: {
      avg: Number(rawAvg.toFixed(1)),
      total: totalAll,
    },
  });
});

