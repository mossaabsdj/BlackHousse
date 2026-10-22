import { prisma } from "@/lib/prisma";
import { admin, json } from "@/lib/admin/http";
import { GROUP_INCLUDE, parseGroupBody, toAdminGroup } from "@/lib/admin/catalog";

export const dynamic = "force-dynamic";

// Full replace of the group AND its options: existing ids are updated, new ones created, missing ones deleted.
export const PUT = admin(async ({ params, body }) => {
  const { data, options } = parseGroupBody(body);
  const row = await prisma.$transaction(async (tx) => {
    await tx.optionGroup.update({ where: { id: params.id }, data }); // throws P2025 -> 404 if missing
    const existing = new Set((await tx.option.findMany({ where: { groupId: params.id }, select: { id: true } })).map((o) => o.id));
    const keep = [];
    for (const { id, ...o } of options) {
      if (id && existing.has(id)) {
        await tx.option.update({ where: { id }, data: o });
        keep.push(id);
      } else {
        const created = await tx.option.create({ data: { ...o, groupId: params.id } });
        keep.push(created.id);
      }
    }
    await tx.option.deleteMany({ where: { groupId: params.id, id: { notIn: keep } } });
    return tx.optionGroup.findUnique({ where: { id: params.id }, include: GROUP_INCLUDE });
  });
  return json({ item: toAdminGroup(row) });
});

// Options are deleted with the group and unlinked from products. Past orders keep their own copy of the names.
export const DELETE = admin(async ({ params }) => {
  await prisma.optionGroup.delete({ where: { id: params.id } });
  return json({ ok: true });
});