import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { optionSpec } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

// Quick edit of one option (e.g. mark "out of stock" with { available: false }).
export const PATCH = admin(async ({ params, body }) => {
  const item = await prisma.option.update({ where: { id: params.id }, data: parse(body, optionSpec, { partial: true }) });
  return json({ item });
});