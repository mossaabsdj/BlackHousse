import { prisma } from "@/lib/prisma";
import { admin, HttpError, json, parse } from "@/lib/admin/http";
import { categorySpec } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

export const PATCH = admin(async ({ params, body }) => {
  const item = await prisma.category.update({ where: { id: params.id }, data: parse(body, categorySpec, { partial: true }) });
  return json({ item });
});

export const DELETE = admin(async ({ params }) => {
  const n = await prisma.product.count({ where: { categoryId: params.id } });
  if (n > 0) throw new HttpError(409, "IN_USE", `Impossible : cette catégorie contient ${n} produit(s). Déplacez-les ou masquez la catégorie.`);
  await prisma.category.delete({ where: { id: params.id } });
  return json({ ok: true });
});