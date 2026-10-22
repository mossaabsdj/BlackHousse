import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { PRODUCT_INCLUDE, assertProductRefs, parseGroupIds, productSpec, toAdminProduct } from "@/lib/admin/catalog";
import { syncProductChange, syncProductDelete } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Partial update: quick toggles send only { available } or { isActive }; the form sends everything.
export const PATCH = admin(async ({ params, body }) => {
  const data = parse(body, productSpec, { partial: true });
  const groupIds = parseGroupIds(body);
  await assertProductRefs(prisma, { categoryId: data.categoryId, groupIds });

  const row = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: params.id }, data });
    if (groupIds) {
      await tx.productOptionGroup.deleteMany({ where: { productId: params.id } });
      if (groupIds.length) await tx.productOptionGroup.createMany({ data: groupIds.map((groupId, i) => ({ productId: params.id, groupId, sortOrder: i })) });
    }
    return tx.product.findUnique({ where: { id: params.id }, include: PRODUCT_INCLUDE });
  });

  // Synchronize product availability change to Firebase in real-time
  syncProductChange(params.id, row).catch((err) =>
    console.warn("[products] Firebase sync error:", err.message)
  );

  return json({ item: toAdminProduct(row) });
});

// Past orders keep the product name/price they were made with, so deleting is safe.
export const DELETE = admin(async ({ params }) => {
  await prisma.product.delete({ where: { id: params.id } });

  // Synchronize product deletion to Firebase in real-time
  syncProductDelete(params.id).catch((err) =>
    console.warn("[products] Firebase delete sync error:", err.message)
  );

  return json({ ok: true });
});