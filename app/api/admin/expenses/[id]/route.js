import { prisma } from "@/lib/prisma";
import { admin, json, parse, HttpError } from "@/lib/admin/http";
import { VALID_EXPENSE_CATEGORIES, toExpenseDto } from "@/lib/admin/finance";

export const dynamic = "force-dynamic";

// GET /api/admin/expenses/[id]
export const GET = admin(async ({ params }) => {
  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) throw new HttpError(404, "NOT_FOUND", "Dépense introuvable");
  return json({ item: toExpenseDto(expense) });
});

// PATCH /api/admin/expenses/[id]
export const PATCH = admin(async ({ params, body }) => {
  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) throw new HttpError(404, "NOT_FOUND", "Dépense introuvable");

  const data = parse(
    body,
    {
      amount: { type: "int", min: 1, max: 100_000_000, required: false },
      description: { type: "string", min: 2, max: 250, required: false },
      category: { type: "enum", values: VALID_EXPENSE_CATEGORIES, required: false },
      date: { type: "string", min: 8, max: 35, required: false },
    },
    { partial: true }
  );

  const updateData = {};
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.date !== undefined) {
    const parsed = new Date(data.date);
    if (!isNaN(parsed.getTime())) updateData.date = parsed;
  }

  const updated = await prisma.expense.update({
    where: { id: params.id },
    data: updateData,
  });

  return json({ item: toExpenseDto(updated) });
});

// PUT /api/admin/expenses/[id]
export const PUT = PATCH;

// DELETE /api/admin/expenses/[id]
export const DELETE = admin(async ({ params }) => {
  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) throw new HttpError(404, "NOT_FOUND", "Dépense introuvable");

  await prisma.expense.delete({ where: { id: params.id } });
  return json({ ok: true, id: params.id });
});

