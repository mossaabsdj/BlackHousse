import { prisma } from "@/lib/prisma";
import { admin, json } from "@/lib/admin/http";
import { GROUP_INCLUDE, parseGroupBody, toAdminGroup } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

export const GET = admin(async () => {
  const rows = await prisma.optionGroup.findMany({ orderBy: { name: "asc" }, include: GROUP_INCLUDE });
  return json({ items: rows.map(toAdminGroup) });
});

// Creates the group together with its options.
export const POST = admin(async ({ body }) => {
  const { data, options } = parseGroupBody(body);
  const row = await prisma.optionGroup.create({
    data: { ...data, options: { create: options.map(({ id, ...o }) => o) } },
    include: GROUP_INCLUDE,
  });
  return json({ item: toAdminGroup(row) }, 201);
});