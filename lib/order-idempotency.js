import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

const LOCK_TTL = 120; // 2 minutes

// Acquire an exclusive lock for an order submission
export async function acquireOrderLock(idemKey) {
  const key = `idempotency:orders:${idemKey}`;

  const token = randomUUID();

  const result = await redis.set(key, token, {
    nx: true,
    ex: LOCK_TTL,
  });

  return {
    key,
    token,
    acquired: result === "OK",
  };
}

// Release the lock only if it belongs to this request
export async function releaseOrderLock({ key, token }) {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end

    return 0
  `;

  return redis.eval(script, [key], [token]);
}