import { prisma } from "@/lib/prisma";
import { admin, json, parse } from "@/lib/admin/http";
import { EXPENSE_CATEGORIES, VALID_EXPENSE_CATEGORIES, toExpenseDto } from "@/lib/admin/finance";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

// GET /api/admin/expenses?page=1&q=viande&category=INGREDIENTS&from=2026-10-01&to=2026-10-31
export const GET = admin(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const category = sp.get("category");
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || String(PAGE_SIZE), 10) || PAGE_SIZE));

  const where = {};
  if (category && VALID_EXPENSE_CATEGORIES.includes(category)) {
    where.category = category;
  }
  if (q) {
    where.description = { contains: q, mode: "insensitive" };
  }
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from.includes("T") ? from : `${from}T00:00:00.000Z`);
    if (to) where.date.lte = new Date(to.includes("T") ? to : `${to}T23:59:59.999Z`);
  }

  const [rows, total, sumAggregate] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  return json({
    items: rows.map(toExpenseDto),
    total,
    totalAmount: sumAggregate._sum.amount || 0,
    page,
    pageSize,
    categories: EXPENSE_CATEGORIES,
  });
});

// POST /api/admin/expenses
export const POST = admin(async ({ body }) => {
  const data = parse(body, {
    amount: { type: "int", min: 1, max: 100_000_000, required: true },
    description: { type: "string", min: 2, max: 250, required: true },
    category: { type: "enum", values: VALID_EXPENSE_CATEGORIES, default: "AUTRE" },
    date: { type: "string", min: 8, max: 35, required: false },
  });

  let expenseDate = new Date();
  if (data.date) {
    const parsed = new Date(data.date);
    if (!isNaN(parsed.getTime())) expenseDate = parsed;
  }

  const created = await prisma.expense.create({
    data: {
      amount: data.amount,
      description: data.description,
      category: data.category,
      date: expenseDate,
    },
  });

  return json({ item: toExpenseDto(created) }, 201);
});

