import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const hasUpstash = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
  (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
);

let redisLimiter: Ratelimit | null = null;

if (hasUpstash) {
  try {
    const redis = Redis.fromEnv();
    redisLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "blackhousse:ratelimit:orders",
    });
  } catch (err) {
    console.warn("[RateLimit] Upstash Redis initialization error:", err);
  }
}

// In-memory sliding window fallback for local testing or when Upstash is not configured
const memoryBuckets = new Map<string, number[]>();

function memoryLimit(identifier: string, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const timestamps = (memoryBuckets.get(identifier) || []).filter(
    (ts) => ts > now - windowMs
  );

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const reset = oldest + windowMs;
    return {
      success: false,
      limit,
      remaining: 0,
      reset,
    };
  }

  timestamps.push(now);
  memoryBuckets.set(identifier, timestamps);

  return {
    success: true,
    limit,
    remaining: limit - timestamps.length,
    reset: now + windowMs,
  };
}

export const orderRateLimit = {
  async limit(identifier: string) {
    if (redisLimiter) {
      return await redisLimiter.limit(identifier);
    }
    return memoryLimit(identifier, 5, 10 * 60 * 1000);
  },
};
