"use client";
import { useCallback, useEffect, useState } from "react";

export const STORAGE = {
  cart: "blackhousse:cart:v1",
  orders: "blackhousse:orders:v1", // true once an order was placed here (shows "Track my order")
  customer: "blackhousse:customer:v1", // persistent customer profile: { name, phone, fulfillment, municipalityId, municipalityText, address }
  checkoutDraft: "blackhousse:checkout:draft:v1", // in-progress checkout draft: { notes, ... }
};
export const MAX_QTY = 50;

export const read = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
export const write = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app keeps working, just without persistence */
  }
};

/* ------------------------------ helpers ------------------------------ */

export const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const formatPrice = (value, currency) => {
  let locale = "fr-FR";
  let curr = currency;
  try {
    const loc = typeof window !== "undefined" ? window.localStorage.getItem("blackhousse:locale") : "fr";
    if (loc === "ar") {
      locale = "ar-DZ";
      if (!curr || curr === "DA") curr = "د.ج";
    } else if (loc === "en") {
      locale = "en-US";
      if (!curr) curr = "DA";
    }
  } catch {}
  if (!curr) curr = "DA";
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value) || 0);
  return `${num} ${curr}`;
};

export const normalizePhone = (p) => String(p || "").replace(/[\s.\-()]/g, "");
export const isValidPhone = (p) => /^\+?\d{8,15}$/.test(normalizePhone(p));

export const makeKey = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const formatDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  let locale = "fr-FR";
  try {
    const loc = typeof window !== "undefined" ? window.localStorage.getItem("blackhousse:locale") : "fr";
    if (loc === "ar") locale = "ar-DZ";
    else if (loc === "en") locale = "en-US";
  } catch {}
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
};

/* ------------------------- selection & pricing ------------------------ */
// selection = { [groupId]: [optionId, ...] }

export function cleanSelection(sel = {}) {
  const out = {};
  for (const g of Object.keys(sel)) {
    const ids = Array.isArray(sel[g]) ? sel[g].map(String) : [];
    if (ids.length) out[g] = ids;
  }
  return out;
}

export function lineKeyOf(productId, selection) {
  const s = cleanSelection(selection);
  const parts = Object.keys(s)
    .sort()
    .map((g) => `${g}:${[...s[g]].sort().join(",")}`);
  return `${productId}|${parts.join(";")}`;
}

/** Pre-selects the first available option of required single-choice groups (e.g. size). */
export function defaultSelection(product) {
  const sel = {};
  for (const g of product.optionGroups) {
    if (g.type === "single" && g.required) {
      const first = g.options.find((o) => o.available);
      if (first) sel[g.id] = [first.id];
    }
  }
  return sel;
}

/** Drops option ids that no longer exist or are unavailable. */
export function sanitizeSelection(product, selection = {}) {
  const out = {};
  for (const g of product.optionGroups) {
    const ids = (selection[g.id] || []).filter((id) => g.options.some((o) => o.id === id && o.available));
    if (ids.length) out[g.id] = ids;
  }
  return out;
}

export function unitPriceOf(product, selection) {
  let total = product.price;
  for (const g of product.optionGroups) {
    const chosen = selection[g.id] || [];
    for (const o of g.options) if (chosen.includes(o.id)) total += o.price;
  }
  return total;
}

export function missingGroups(product, selection) {
  return product.optionGroups.filter((g) => {
    const n = (selection[g.id] || []).length;
    return n < g.min || n > g.max || (g.required && n === 0);
  });
}

export function groupHint(g, t) {
  const p = t.product;
  const finiteMax = Number.isFinite(g.max);
  if (g.type === "single") return g.required ? p.chooseOne : p.optional;
  if (g.min > 0 && finiteMax)
    return g.min === g.max ? fmt(p.chooseExactly, { n: g.min }) : fmt(p.chooseBetween, { min: g.min, max: g.max });
  if (g.min > 0) return fmt(p.chooseAtLeast, { min: g.min });
  if (finiteMax) return fmt(p.chooseUpTo, { max: g.max });
  return p.optional;
}

/** Re-prices a cart line against the CURRENT catalog and checks it can still be ordered. */
export function resolveLine(line, productsById) {
  const product = productsById.get(line.productId) || null;
  if (!product) {
    return { line, product: null, ok: false, reason: "missing", unitPrice: 0, total: 0, optionNames: [] };
  }
  let ok = product.available;
  let reason = ok ? null : "unavailable";
  const optionNames = [];
  for (const [gid, ids] of Object.entries(line.selection)) {
    const g = product.optionGroups.find((x) => x.id === gid);
    for (const id of ids) {
      const o = g?.options.find((x) => x.id === id);
      if (!o || !o.available) {
        ok = false;
        reason = reason || "option";
      } else optionNames.push(o.name);
    }
  }
  if (ok && missingGroups(product, line.selection).length) {
    ok = false;
    reason = "invalid";
  }
  const unitPrice = unitPriceOf(product, line.selection);
  return { line, product, ok, reason, unitPrice, total: unitPrice * line.quantity, optionNames };
}

export function computeTotals(resolved) {
  let count = 0;
  let subtotal = 0;
  let blocked = false;
  for (const r of resolved) {
    count += r.line.quantity;
    if (r.ok) subtotal += r.total;
    else blocked = true;
  }
  return { count, subtotal, blocked };
}

/** Prices are NOT sent: the server recomputes them from the database. */
export function buildOrderPayload({ resolved, customer, fulfillment, delivery, notes, expectedSubtotal }) {
  return {
    customer,
    fulfillment, // "delivery" | "pickup"
    delivery: fulfillment === "delivery" ? delivery : null,
    notes: notes || "",
    expectedSubtotal, // lets the server detect stale prices (PRICE_CHANGED)
    items: resolved.map((r) => ({
      productId: r.line.productId,
      quantity: r.line.quantity,
      options: Object.entries(r.line.selection).map(([groupId, optionIds]) => ({ groupId, optionIds })),
    })),
  };
}

/* ------------------------------ cart store ---------------------------- */

function sanitizeLines(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const l of raw) {
    if (!l || (typeof l.productId !== "string" && typeof l.productId !== "number")) continue;
    const quantity = Math.floor(Number(l.quantity));
    if (!(quantity > 0)) continue;
    const productId = String(l.productId);
    const selection = cleanSelection(l.selection && typeof l.selection === "object" ? l.selection : {});
    const key = lineKeyOf(productId, selection);
    const existing = out.find((x) => x.key === key);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, MAX_QTY);
    else out.push({ key, productId, selection, quantity: Math.min(quantity, MAX_QTY) });
  }
  return out;
}

function addLine(prev, productId, selection, quantity, at = -1) {
  const sel = cleanSelection(selection);
  const key = lineKeyOf(productId, sel);
  const i = prev.findIndex((l) => l.key === key);
  if (i >= 0) {
    return prev.map((l, idx) => (idx === i ? { ...l, quantity: Math.min(l.quantity + quantity, MAX_QTY) } : l));
  }
  const line = { key, productId: String(productId), selection: sel, quantity: Math.min(quantity, MAX_QTY) };
  const next = [...prev];
  next.splice(at < 0 ? next.length : at, 0, line);
  return next;
}

export function useCart() {
  const [lines, setLines] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(sanitizeLines(read(STORAGE.cart, [])));
    setHydrated(true);
    const onStorage = (e) => e.key === STORAGE.cart && setLines(sanitizeLines(read(STORAGE.cart, [])));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (hydrated) write(STORAGE.cart, lines);
  }, [lines, hydrated]);

  const add = useCallback((productId, selection, quantity = 1) => setLines((p) => addLine(p, productId, selection, quantity)), []);
  const setQuantity = useCallback(
    (key, q) =>
      setLines((p) =>
        q <= 0 ? p.filter((l) => l.key !== key) : p.map((l) => (l.key === key ? { ...l, quantity: Math.min(q, MAX_QTY) } : l))
      ),
    []
  );
  const remove = useCallback((key) => setLines((p) => p.filter((l) => l.key !== key)), []);
  const replace = useCallback(
    (oldKey, productId, selection, quantity) =>
      setLines((p) => {
        const at = p.findIndex((l) => l.key === oldKey);
        return addLine(p.filter((l) => l.key !== oldKey), productId, selection, quantity, at);
      }),
    []
  );
  const clear = useCallback(() => setLines([]), []);

  return { lines, hydrated, add, setQuantity, remove, replace, clear };
}

/* ------------------- "my orders" (floating track button) ------------------- */

export function useMyOrders() {
  const [hasOrders, setHasOrders] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  useEffect(() => {
    setHasOrders(Boolean(read(STORAGE.orders, false)));
    const c = read(STORAGE.customer, null);
    if (c) {
      setCustomer({
        name: String(c.name || ""),
        phone: String(c.phone || ""),
        fulfillment: String(c.fulfillment || ""),
        municipalityId: String(c.municipalityId || ""),
        municipalityText: String(c.municipalityText || ""),
        address: String(c.address || ""),
      });
    }
  }, []);

  const save = useCallback((order, who) => {
    write(STORAGE.orders, true);
    setHasOrders(true);
    if (who) {
      const prev = read(STORAGE.customer, {}) || {};
      const c = {
        ...prev,
        ...who,
        name: who.name,
        phone: who.phone,
      };
      write(STORAGE.customer, c);
      setCustomer(c);
    }
  }, []);

  return { hasOrders, customer, save };
}