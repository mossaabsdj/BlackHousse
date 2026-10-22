import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { admin } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

// GET /api/admin/database/export
export const GET = admin(async () => {
  const [
    categories,
    optionGroups,
    options,
    products,
    productOptionGroups,
    municipalities,
    expenses,
    orders,
    comptes,
  ] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.optionGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.option.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.productOptionGroup.findMany(),
    prisma.municipality.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
    prisma.order.findMany({
      include: {
        items: {
          include: {
            options: true,
          },
        },
        history: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.compte.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        Password: true,
        role: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const timestamp = new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);

  const payload = {
    meta: {
      app: "BlackHousse",
      version: "1.0",
      exportedAt: timestamp,
      counts: {
        categories: categories.length,
        optionGroups: optionGroups.length,
        options: options.length,
        products: products.length,
        productOptionGroups: productOptionGroups.length,
        municipalities: municipalities.length,
        expenses: expenses.length,
        orders: orders.length,
        comptes: comptes.length,
      },
    },
    data: {
      categories,
      optionGroups,
      options,
      products,
      productOptionGroups,
      municipalities,
      expenses,
      orders,
      comptes,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="blackhousse-database-backup-${dateStr}.json"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
});
