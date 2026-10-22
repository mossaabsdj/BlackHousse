import { prisma } from "@/lib/prisma";
import { admin, json } from "@/lib/admin/http";
import { EXPENSE_CATEGORIES } from "@/lib/admin/finance";

export const dynamic = "force-dynamic";

/**
 * Calculates start and end Date objects for preset or custom periods.
 */
function getDateRange(period, customFrom, customTo) {
  const now = new Date();

  // Helper: start of a day in UTC
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  };

  // Helper: end of a day in UTC
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x;
  };

  let start;
  let end;
  let prevStart;
  let prevEnd;
  let label = "Aujourd'hui";

  switch (period) {
    case "yesterday": {
      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      start = startOfDay(y);
      end = endOfDay(y);

      const py = new Date(now);
      py.setUTCDate(py.getUTCDate() - 2);
      prevStart = startOfDay(py);
      prevEnd = endOfDay(py);
      label = "Hier";
      break;
    }
    case "this_week": {
      // Monday of current week
      const day = now.getUTCDay(); // 0 is Sun, 1 is Mon...
      const diff = (day === 0 ? -6 : 1) - day;
      const mon = new Date(now);
      mon.setUTCDate(now.getUTCDate() + diff);
      start = startOfDay(mon);
      end = endOfDay(now);

      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = "Cette semaine";
      break;
    }
    case "this_month": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      end = endOfDay(now);

      // Previous month
      prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      const lastDayPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      prevEnd = lastDayPrevMonth;
      label = "Ce mois-ci";
      break;
    }
    case "last_month": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      // Month before last
      prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0, 23, 59, 59, 999));
      label = "Le mois dernier";
      break;
    }
    case "custom": {
      if (customFrom) {
        start = customFrom.includes("T") ? new Date(customFrom) : new Date(`${customFrom}T00:00:00.000Z`);
      } else {
        start = startOfDay(now);
      }
      if (customTo) {
        end = customTo.includes("T") ? new Date(customTo) : new Date(`${customTo}T23:59:59.999Z`);
      } else {
        end = endOfDay(now);
      }
      const duration = Math.max(86400000, end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      label = "Période personnalisée";
      break;
    }
    case "today":
    default: {
      start = startOfDay(now);
      end = endOfDay(now);

      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      prevStart = startOfDay(y);
      prevEnd = endOfDay(y);
      label = "Aujourd'hui";
      break;
    }
  }

  return { start, end, prevStart, prevEnd, label };
}

function calculateDelta(curr, prev) {
  const diff = curr - prev;
  let percent = 0;
  if (prev > 0) {
    percent = Number(((diff / prev) * 100).toFixed(1));
  } else if (curr > 0) {
    percent = 100;
  }
  return { diff, percent };
}

// GET /api/admin/finance/stats?period=this_month&from=...&to=...
export const GET = admin(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const period = sp.get("period") || "today";
  const customFrom = sp.get("from");
  const customTo = sp.get("to");

  const { start, end, prevStart, prevEnd, label } = getDateRange(period, customFrom, customTo);

  // 1. Fetch current period orders
  const currentOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    include: {
      items: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // 2. Fetch previous period orders for comparison
  const prevOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: prevStart, lte: prevEnd },
    },
    select: {
      id: true,
      status: true,
      total: true,
    },
  });

  // 3. Fetch current period expenses
  const currentExpenses = await prisma.expense.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

  // 4. Fetch previous period expenses for comparison
  const prevExpenses = await prisma.expense.findMany({
    where: {
      date: { gte: prevStart, lte: prevEnd },
      },
    select: {
      amount: true,
    },
  });

  // --- Aggregate Current Period Metrics ---
  let grossRevenue = 0;
  let collectedRevenue = 0;
  let pendingRevenue = 0;
  let cancelledRevenue = 0;
  let deliveryRevenue = 0;
  let itemsRevenue = 0;
  let ordersCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;

  const fulfillmentStats = {
    delivery: { count: 0, total: 0 },
    pickup: { count: 0, total: 0 },
  };

  const productStats = new Map();

  for (const o of currentOrders) {
    if (o.status === "CANCELLED") {
      cancelledCount++;
      cancelledRevenue += o.total;
      continue;
    }

    ordersCount++;
    grossRevenue += o.total;
    deliveryRevenue += o.deliveryFee || 0;
    itemsRevenue += o.subtotal || 0;

    if (o.status === "COMPLETED") {
      completedCount++;
      collectedRevenue += o.total;
    } else {
      pendingRevenue += o.total;
    }

    if (o.fulfillment === "DELIVERY") {
      fulfillmentStats.delivery.count++;
      fulfillmentStats.delivery.total += o.total;
    } else {
      fulfillmentStats.pickup.count++;
      fulfillmentStats.pickup.total += o.total;
    }

    for (const it of o.items || []) {
      const existing = productStats.get(it.productName) || { name: it.productName, quantity: 0, revenue: 0 };
      existing.quantity += it.quantity;
      existing.revenue += it.lineTotal;
      productStats.set(it.productName, existing);
    }
  }

  const totalExpenses = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossRevenue - totalExpenses;
  const averageOrderValue = ordersCount > 0 ? Math.round(grossRevenue / ordersCount) : 0;
  const profitMargin = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

  // --- Aggregate Previous Period Metrics ---
  let prevGrossRevenue = 0;
  let prevOrdersCount = 0;
  for (const po of prevOrders) {
    if (po.status !== "CANCELLED") {
      prevOrdersCount++;
      prevGrossRevenue += po.total;
    }
  }
  const prevTotalExpenses = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
  const prevNetProfit = prevGrossRevenue - prevTotalExpenses;

  const comparison = {
    revenue: calculateDelta(grossRevenue, prevGrossRevenue),
    expenses: calculateDelta(totalExpenses, prevTotalExpenses),
    netProfit: calculateDelta(netProfit, prevNetProfit),
    orders: calculateDelta(ordersCount, prevOrdersCount),
    prev: {
      revenue: prevGrossRevenue,
      expenses: prevTotalExpenses,
      netProfit: prevNetProfit,
      ordersCount: prevOrdersCount,
    },
  };

  // --- Expense Categories Distribution ---
  const catTotals = {};
  for (const c of EXPENSE_CATEGORIES) {
    catTotals[c.value] = { category: c.value, label: c.label, total: 0, count: 0, percentage: 0 };
  }
  for (const e of currentExpenses) {
    if (!catTotals[e.category]) {
      catTotals[e.category] = { category: e.category, label: e.category, total: 0, count: 0, percentage: 0 };
    }
    catTotals[e.category].total += e.amount;
    catTotals[e.category].count++;
  }
  const expenseCategories = Object.values(catTotals)
    .filter((c) => c.count > 0 || totalExpenses === 0)
    .map((c) => ({
      ...c,
      percentage: totalExpenses > 0 ? Number(((c.total / totalExpenses) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // --- Timeline Chart Data (Daily aggregation) ---
  const timelineMap = new Map();

  // Initialize all days in the range
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const dayLabel = cursor.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    timelineMap.set(key, {
      date: key,
      label: dayLabel,
      revenue: 0,
      expenses: 0,
      profit: 0,
      orders: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Populate orders in timeline
  for (const o of currentOrders) {
    if (o.status === "CANCELLED") continue;
    const key = o.createdAt.toISOString().slice(0, 10);
    const item = timelineMap.get(key);
    if (item) {
      item.revenue += o.total;
      item.orders++;
    }
  }

  // Populate expenses in timeline
  for (const e of currentExpenses) {
    const key = e.date.toISOString().slice(0, 10);
    const item = timelineMap.get(key);
    if (item) {
      item.expenses += e.amount;
    }
  }

  // Compute profit for each timeline item
  for (const item of timelineMap.values()) {
    item.profit = item.revenue - item.expenses;
  }

  const timeline = Array.from(timelineMap.values());

  // --- Top 5 Products ---
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return json({
    period: {
      type: period,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      prevStart: prevStart.toISOString(),
      prevEnd: prevEnd.toISOString(),
    },
    summary: {
      grossRevenue,
      collectedRevenue,
      pendingRevenue,
      cancelledRevenue,
      deliveryRevenue,
      itemsRevenue,
      totalExpenses,
      netProfit,
      ordersCount,
      completedCount,
      cancelledCount,
      averageOrderValue,
      profitMargin,
    },
    comparison,
    timeline,
    expenseCategories,
    fulfillment: fulfillmentStats,
    topProducts,
  });
});
