import crypto from "node:crypto";

/* ------------------------------ phone ------------------------------ */

/** Canonical form used for BOTH storing and matching phones (Algerian numbers: +213/213 -> 0…). */
export function canonicalPhone(p) {
  let s = String(p ?? "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+213")) s = "0" + s.slice(4);
  else if (/^213\d{9}$/.test(s)) s = "0" + s.slice(3);
  return s;
}
export const isValidPhone = (p) => /^\+?\d{8,15}$/.test(canonicalPhone(p));

/* ------------------------------ reference ------------------------------ */

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O/1/I/L/U to avoid read-out mistakes

/** BH-YYMMDD-XXXXX. Uniqueness is enforced by the DB (unique index) + retry on collision. */
export function generateReference(now = new Date()) {
  const day = now.toISOString().slice(2, 10).replace(/-/g, "");
  let rand = "";
  for (let i = 0; i < 5; i++) rand += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `BH-${day}-${rand}`;
}

/* ----------------------------- rate limiting ----------------------------- */
// In-memory fixed window: fine for one server instance. On serverless/multi-instance
// deployments replace with a shared store (Upstash/Redis) keeping the same signature.

const buckets = new Map();
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

export const clientIp = (request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";