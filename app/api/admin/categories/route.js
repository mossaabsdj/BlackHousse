import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { categorySpec } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

export const GET = admin(async () => {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
  return json({
    items: rows.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, isActive: c.isActive, productCount: c._count.products })),
  });
});

export const POST = admin(async ({ body }) => {
  const item = await prisma.category.create({ data: parse(body, categorySpec) });
  return json({ item }, 201);
});