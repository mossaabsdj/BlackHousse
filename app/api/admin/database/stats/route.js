import { prisma } from "@/lib/prisma";
import { admin, json } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

// GET /api/admin/database/stats
export const GET = admin(async () => {
  const [
    categories,
    products,
    optionGroups,
    options,
    municipalities,
    expenses,
    orders,
    revenueAgg,
  ] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.optionGroup.count(),
    prisma.option.count(),
    prisma.municipality.count(),
    prisma.expense.count(),
    prisma.order.count(),
    prisma.compte.count(),
    prisma.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { total: true },
    }),
  ]);

  return json({
    stats: {
      categories,
      products,
      optionGroups,
      options,
      municipalities,
      expenses,
      orders,
      comptes,
      completedRevenue: revenueAgg._sum.total || 0,
    },
  });
});

