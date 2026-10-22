import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { PRODUCT_INCLUDE, assertProductRefs, parseGroupIds, productSpec, toAdminProduct } from "@/lib/admin/catalog";
import { syncProductChange } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export const GET = admin(async () => {
  const rows = await prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: PRODUCT_INCLUDE });
  return json({ items: rows.map(toAdminProduct) });
});

export const POST = admin(async ({ body }) => {
  const data = parse(body, productSpec);
  const groupIds = parseGroupIds(body) ?? [];
  await assertProductRefs(prisma, { categoryId: data.categoryId, groupIds });
  const row = await prisma.product.create({
    data: { ...data, optionGroups: { create: groupIds.map((groupId, i) => ({ groupId, sortOrder: i })) } },
    include: PRODUCT_INCLUDE,
  });

  // Synchronize new product to Firebase in real-time
  syncProductChange(row.id, row).catch((err) =>
    console.warn("[products] Firebase new product sync error:", err.message)
  );

  return json({ item: toAdminProduct(row) }, 201);
});