import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { municipalitySpec } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

export const GET = admin(async () => {
  const rows = await prisma.municipality.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { orders: true } } },
  });
  return json({
    items: rows.map((m) => ({ id: m.id, name: m.name, deliveryFee: m.deliveryFee, sortOrder: m.sortOrder, isActive: m.isActive, orderCount: m._count.orders })),
  });
});

export const POST = admin(async ({ body }) => {
  const item = await prisma.municipality.create({ data: parse(body, municipalitySpec) });
  return json({ item }, 201);
});