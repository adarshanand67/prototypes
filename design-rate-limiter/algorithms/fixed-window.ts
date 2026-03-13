import redis from '../config/redis.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  currentCount?: number;
  algorithm: string;
}

export interface RateLimitStats {
  currentCount: number;
  maxRequests: number;
  remaining: number;
  windowSeconds: number;
  algorithm: string;
}

/**
 * Fixed Window Algorithm
 * - Divides time into fixed windows (e.g., 1 minute)
 * - Resets counter at window boundaries
 * - Simple and memory efficient
 * - Drawback: Burst at window boundaries
 * - Best for: Simple rate limiting with acceptable burst tolerance
 */
export class FixedWindow {
  readonly maxRequests: number;
  readonly windowSeconds: number;
  readonly algorithm = 'fixed-window';

  constructor(maxRequests: number = 10, windowSeconds: number = 60) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async isAllowed(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;

    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, this.windowSeconds);
    }

    const allowed = count <= this.maxRequests;
    const windowEnd = (windowStart + 1) * this.windowSeconds * 1000;

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - count),
      resetAt: windowEnd,
      currentCount: count,
      algorithm: this.algorithm,
    };
  }

  async reset(identifier: string): Promise<void> {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;
    await redis.del(key);
  }

  async getStats(identifier: string): Promise<RateLimitStats> {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;

    const count = await redis.get(key);
    const currentCount = parseInt(count ?? '0');

    return {
      currentCount,
      maxRequests: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - currentCount),
      windowSeconds: this.windowSeconds,
      algorithm: this.algorithm,
    };
  }
}
