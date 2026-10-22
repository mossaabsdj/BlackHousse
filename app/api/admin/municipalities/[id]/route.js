import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { municipalitySpec } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

export const PATCH = admin(async ({ params, body }) => {
  const item = await prisma.municipality.update({ where: { id: params.id }, data: parse(body, municipalitySpec, { partial: true }) });
  return json({ item });
});

// Past orders keep their own copy of the municipality name, so deleting is safe.
export const DELETE = admin(async ({ params }) => {
  await prisma.municipality.delete({ where: { id: params.id } });
  return json({ ok: true });
});