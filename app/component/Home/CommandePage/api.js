/**
 * ALL backend knowledge lives in this file.
 * Point ENDPOINTS at your existing API routes and, if your field names differ,
 * adjust the normalize* functions (they already accept common aliases).
 * See ORDERING_API.md for the exact contract and the server-side security rules.
 */
export const ENDPOINTS = {
  catalog: "/api/products", // GET  -> categories + products (with option groups)
  municipalities: "/api/delivery/municipalities", // GET  -> optional list of delivery municipalities
  createOrder: "/api/orders", // POST -> creates the order
  trackOrders: "/api/orders/track", // POST { phone, reference } -> customer orders created within last 6 hours
  cancelOrder: "/api/orders/cancel", // POST { reference, phone } -> cancels customer order if PENDING
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(url, { method = "GET", body, headers = {}, signal } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("NETWORK", { code: "NETWORK" });
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || `HTTP_${res.status}`, {
      status: res.status,
      code: data?.code || null,
      fields: data?.fields || null,
    });
  }
  return data;
}

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const str = (v) => (v === undefined || v === null ? "" : String(v));
const isAvailable = (o) => o?.available !== false && o?.isAvailable !== false && o?.active !== false;

/* ---------------------------- normalizers ---------------------------- */

function normalizeOption(o) {
  return {
    id: str(o.id ?? o._id),
    name: str(o.name ?? o.label ?? o.title),
    price: num(o.price ?? o.priceDelta ?? o.extraPrice),
    available: isAvailable(o),
  };
}

function normalizeGroup(g) {
  const multiple =
    g.type === "multiple" || g.multiple === true || g.selection === "multiple" || num(g.max, 1) > 1;
  const required = g.required === true || num(g.min ?? g.minSelect) > 0;
  const min = Math.max(num(g.min ?? g.minSelect, required ? 1 : 0), required ? 1 : 0);
  const rawMax = g.max ?? g.maxSelect;
  return {
    id: str(g.id ?? g._id),
    name: str(g.name ?? g.label ?? g.title),
    type: multiple ? "multiple" : "single",
    required,
    min: multiple ? min : required ? 1 : 0,
    max: multiple ? (rawMax == null ? Infinity : num(rawMax, Infinity)) : 1,
    options: (g.options ?? g.choices ?? g.items ?? []).map(normalizeOption),
  };
}

function normalizeProduct(p) {
  const cat = p.category && typeof p.category === "object" ? p.category : null;
  let categoryId = "";
  if (p.categoryId != null) categoryId = str(p.categoryId);
  else if (p.category_id != null) categoryId = str(p.category_id);
  else if (cat) categoryId = str(cat.id ?? cat._id);
  else if (p.category != null) categoryId = str(p.category);
  return {
    id: str(p.id ?? p._id),
    name: str(p.name ?? p.title),
    description: str(p.description),
    price: num(p.price ?? p.basePrice),
    image: p.image ?? p.imageUrl ?? p.img ?? null,
    categoryId,
    categoryName: cat?.name ?? null,
    available: isAvailable(p) && p.inStock !== false,
    optionGroups: (p.optionGroups ?? p.customizations ?? p.option_groups ?? []).map(normalizeGroup),
  };
}

export function normalizeCatalog(json) {
  const rawProducts = Array.isArray(json) ? json : json?.products ?? json?.data ?? [];
  const rawCategories = Array.isArray(json) ? [] : json?.categories ?? [];
  const products = rawProducts.map(normalizeProduct).filter((p) => p.id && p.name);

  const categories = rawCategories
    .map((c) => ({ id: str(c.id ?? c._id), name: str(c.name ?? c.label ?? c.title) }))
    .filter((c) => c.id && c.name);

  // Derive missing categories from the products themselves (names come from the API only)
  for (const p of products) {
    if (p.categoryId && !categories.some((c) => c.id === p.categoryId)) {
      categories.push({ id: p.categoryId, name: p.categoryName || p.categoryId });
    }
  }
  return { categories, products };
}

export function normalizeMunicipality(m) {
  const fee = m.deliveryFee ?? m.fee ?? m.price;
  return {
    id: str(m.id ?? m._id ?? m.name),
    name: str(m.name ?? m.label),
    deliveryFee: fee == null || fee === "" ? null : num(fee),
  };
}

function normalizeFulfillment(v) {
  const s = str(v).toLowerCase();
  if (/deliver|livr/.test(s)) return "delivery";
  if (/pick|retrait|emporter|collect/.test(s)) return "pickup";
  return null;
}

export function normalizeOrder(o) {
  if (!o) return null;
  const items = (o.items ?? o.lines ?? []).map((it) => {
    const quantity = num(it.quantity ?? it.qty, 1);
    return {
      name: str(it.name ?? it.product?.name ?? it.productName),
      quantity,
      unitPrice: it.unitPrice == null ? null : num(it.unitPrice),
      options: (it.options ?? it.selectedOptions ?? [])
        .map((x) => (typeof x === "string" ? x : x?.name ?? x?.label ?? x?.optionName))
        .filter(Boolean),
      total: num(it.total ?? it.lineTotal, num(it.unitPrice ?? it.price) * quantity),
    };
  });
  const delivery = o.delivery ?? (o.municipalityName || o.address ? { municipality: o.municipalityName, address: o.address } : null);
  return {
    reference: str(o.reference ?? o.ref ?? o.orderNumber ?? o.id),
    status: o.status ?? null,
    statusLabel: o.statusLabel ?? null,
    statusHistory: (o.statusHistory ?? o.history ?? []).map((h) => ({
      status: h.status ?? null,
      label: h.label ?? h.status ?? null,
      at: h.at ?? h.createdAt ?? h.date ?? null,
    })),
    createdAt: o.createdAt ?? o.date ?? null,
    fulfillment: normalizeFulfillment(o.fulfillment ?? o.fulfillmentMethod ?? o.type),
    delivery: delivery
      ? { municipality: str(delivery.municipality), address: str(delivery.address) }
      : null,
    subtotal: o.subtotal == null ? null : num(o.subtotal),
    deliveryFee: o.deliveryFee == null ? null : num(o.deliveryFee),
    total: (o.total ?? o.totalPrice) == null ? null : num(o.total ?? o.totalPrice),
    items,
  };
}

/** Public tracking view with complete order details */
function normalizeTracked(o) {
  if (!o) return null;
  const normalized = normalizeOrder(o);
  return {
    ...normalized,
    dailyNumber: o.dailyNumber ?? null,
    customerName: str(o.customerName ?? o.name),
    customerPhone: str(o.customerPhone ?? o.phone),
    updatedAt: o.updatedAt ?? null,
  };
}

/* ------------------------------- calls ------------------------------- */

export const fetchCatalog = async (signal) =>
  normalizeCatalog(await request(ENDPOINTS.catalog, { signal }));

/** Optional endpoint: returns [] when it does not exist (UI falls back to a text field). */
export async function fetchMunicipalities(signal) {
  try {
    const d = await request(ENDPOINTS.municipalities, { signal });
    const list = Array.isArray(d) ? d : d?.municipalities ?? d?.data ?? [];
    return list.map(normalizeMunicipality).filter((m) => m.id && m.name);
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return [];
  }
}

export async function createOrder(payload, idempotencyKey) {
  const d = await request(ENDPOINTS.createOrder, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const order = normalizeOrder(d?.order ?? d);
  if (!order?.reference) throw new ApiError("INVALID_RESPONSE", { code: "INVALID_RESPONSE" });
  return order;
}

export async function trackOrders({ phone, reference } = {}) {
  try {
    const d = await request(ENDPOINTS.trackOrders, {
      method: "POST",
      body: { phone, reference },
    });
    const list = Array.isArray(d) ? d : d?.orders ?? [];
    return list.map(normalizeTracked).filter(Boolean);
  } catch (e) {
    if (e?.status === 404) return [];
    throw e;
  }
}

export async function cancelCustomerOrder({ reference, phone } = {}) {
  return await request(ENDPOINTS.cancelOrder, {
    method: "POST",
    body: { reference, phone },
  });
}
