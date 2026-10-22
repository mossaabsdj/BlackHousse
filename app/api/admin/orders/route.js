import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { admin, json, HttpError } from "@/lib/admin/http";
import { ORDER_INCLUDE, STATUS_LABELS, getOrderStatusLabel } from "@/lib/ordering/orders";
import { canonicalPhone, generateReference } from "@/lib/ordering/security";
import { syncOrderCreated } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export const toAdminOrder = (o) => ({
  id: o.id,
  reference: o.reference,
  dailyNumber: o.dailyNumber ?? null,
  status: o.status,
  statusLabel: getOrderStatusLabel(o.status, o.fulfillment),
  fulfillment: o.fulfillment === "DELIVERY" ? "delivery" : "pickup",
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  municipalityName: o.municipalityName,
  address: o.address,
  notes: o.notes,
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  total: o.total,
  createdAt: o.createdAt.toISOString(),
  items: o.items.map((i) => ({
    name: i.productName,
    quantity: i.quantity,
    options: i.options.map((x) => x.optionName),
    total: i.lineTotal,
  })),
});

// GET /api/admin/orders?scope=active&status=PENDING&q=ahmed&page=1&from=...&to=...
export const GET = admin(async ({ request }) => {
  const sp = new URL(request.url).searchParams;
  const scope = sp.get("scope"); // "active" | "history" | null
  const status = sp.get("status");
  const q = (sp.get("q") || "").trim().slice(0, 60);
  const from = sp.get("from");
  const to = sp.get("to");
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || String(PAGE_SIZE), 10) || PAGE_SIZE));

  const where = {};

  // Status and Scope filtering
  if (status && Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
    where.status = status;
  } else if (scope === "active") {
    // Only active (non-completed, non-cancelled) orders
    where.status = { notIn: ["COMPLETED", "CANCELLED"] };
  } else if (scope === "history") {
    // Only completed or cancelled orders
    where.status = { in: ["COMPLETED", "CANCELLED"] };
  }

  // Search filter
  if (q) {
    where.OR = [
      { reference: { contains: q.toUpperCase() } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: canonicalPhone(q) } },
    ];
  }

  // Date range filter
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from.includes("T") ? from : `${from}T00:00:00.000Z`);
    if (to) where.createdAt.lte = new Date(to.includes("T") ? to : `${to}T23:59:59.999Z`);
  }

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  let historySummary = null;
  if (scope === "history") {
    const [completedAgg, cancelledCount] = await Promise.all([
      prisma.order.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: { ...where, status: "CANCELLED" },
      }),
    ]);
    historySummary = {
      completedCount: completedAgg._count._all || 0,
      completedRevenue: completedAgg._sum.total || 0,
      cancelledCount,
      totalCount: (completedAgg._count._all || 0) + cancelledCount,
    };
  }

  // Compute sequential daily numbering (nbr = 1 .. N, resets to 0/1 at midnight for each day)
  const dailyNumberMap = new Map();
  if (rows.length > 0) {
    const dayKeys = [...new Set(rows.map((r) => r.createdAt.toISOString().slice(0, 10)))];
    const dayRanges = dayKeys.map((k) => ({
      gte: new Date(`${k}T00:00:00.000Z`),
      lte: new Date(`${k}T23:59:59.999Z`),
    }));

    const dayOrders = await prisma.order.findMany({
      where: {
        OR: dayRanges.map((range) => ({
          createdAt: { gte: range.gte, lte: range.lte },
        })),
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const groups = {};
    for (const d of dayOrders) {
      const k = d.createdAt.toISOString().slice(0, 10);
      if (!groups[k]) groups[k] = [];
      groups[k].push(d);
    }

    for (const k of Object.keys(groups)) {
      groups[k].forEach((d, idx) => {
        dailyNumberMap.set(d.id, idx + 1);
      });
    }
  }

  // Filter available statuses by scope for UI dropdowns
  let availableStatuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  if (scope === "active") {
    availableStatuses = availableStatuses.filter((s) => !["COMPLETED", "CANCELLED"].includes(s.value));
  } else if (scope === "history") {
    availableStatuses = availableStatuses.filter((s) => ["COMPLETED", "CANCELLED"].includes(s.value));
  }

  return json({
    items: rows.map((r) => toAdminOrder({ ...r, dailyNumber: dailyNumberMap.get(r.id) || 1 })),
    total,
    page,
    pageSize,
    summary: historySummary,
    statuses: availableStatuses,
    allStatuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  });
});

// POST /api/admin/orders - Fast Order Creation for Admin/Cashier
export const POST = admin(async ({ body }) => {
  const customerName = String(body?.customerName || "Client Comptoir").trim().slice(0, 80);
  const rawPhone = String(body?.customerPhone || "").trim();
  const customerPhone = rawPhone ? canonicalPhone(rawPhone) : "0550000000";
  const fulfillment = body?.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP";
  const municipalityName = fulfillment === "DELIVERY" ? String(body?.municipalityName || "").trim() : null;
  const address = fulfillment === "DELIVERY" ? String(body?.address || "").trim() : null;
  const deliveryFee = fulfillment === "DELIVERY" ? Math.max(0, parseInt(body?.deliveryFee || "0", 10) || 0) : 0;
  const notes = String(body?.notes || "").trim().slice(0, 300) || null;
  const initialStatus = Object.keys(STATUS_LABELS).includes(body?.status) ? body.status : "CONFIRMED";

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0) {
    throw new HttpError(422, "NO_ITEMS", "Veuillez sélectionner au moins un article.");
  }

  const itemsData = [];
  let subtotal = 0;

  for (const it of rawItems) {
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseInt(it.unitPrice, 10) || 0);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    const optionsData = (Array.isArray(it.options) ? it.options : []).map((opt) => {
      const name = typeof opt === "string" ? opt : opt.name || opt.optionName || "";
      const price = typeof opt === "object" ? Number(opt.price || 0) : 0;
      return {
        groupName: opt.groupName || "Options",
        optionName: name,
        price,
      };
    }).filter((x) => x.optionName);

    itemsData.push({
      productId: it.productId || null,
      productName: String(it.name || it.productName || "Article").trim(),
      unitPrice,
      quantity: qty,
      lineTotal,
      options: { create: optionsData },
    });
  }

  const total = subtotal + deliveryFee;

  // Calculate today's daily sequential number
  const todayKey = new Date().toISOString().slice(0, 10);
  const startOfDay = new Date(`${todayKey}T00:00:00.000Z`);
  const endOfDay = new Date(`${todayKey}T23:59:59.999Z`);

  const todayCount = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  const dailyNumber = todayCount + 1;

  const idempotencyKey = crypto.randomUUID();
  const requestHash = crypto.randomUUID();

  const order = await prisma.order.create({
    data: {
      reference: generateReference(),
      status: initialStatus,
      fulfillment,
      customerName,
      customerPhone,
      municipalityName,
      address,
      notes,
      subtotal,
      deliveryFee,
      total,
      idempotencyKey,
      requestHash,
      items: {
        create: itemsData,
      },
      history: {
        create: {
          status: initialStatus,
        },
      },
    },
    include: ORDER_INCLUDE,
  });

  order.dailyNumber = dailyNumber;

  // Real-time synchronization to Firebase
  syncOrderCreated(order).catch((err) =>
    console.warn("[admin-orders] Firebase sync error:", err.message)
  );

  return json({ order: toAdminOrder(order) }, 201);
});