import redis from '../config/redis.js';

/**
 * Fixed Window Algorithm
 * - Divides time into fixed windows (e.g., 1 minute)
 * - Resets counter at window boundaries
 * - Simple and memory efficient
 * - Drawback: Burst at window boundaries
 * - Best for: Simple rate limiting with acceptable burst tolerance
 */
export class FixedWindow {
  constructor(maxRequests = 10, windowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
    this.algorithm = 'fixed-window';
  }

  async isAllowed(identifier) {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;

    // Increment counter
    const count = await redis.incr(key);

    // Set expiry on first request in window
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
      algorithm: this.algorithm
    };
  }

  async reset(identifier) {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;
    await redis.del(key);
  }

  async getStats(identifier) {
    const now = Date.now();
    const windowStart = Math.floor(now / (this.windowSeconds * 1000));
    const key = `ratelimit:fixed:${identifier}:${windowStart}`;

    const count = await redis.get(key);
    const currentCount = parseInt(count || 0);

    return {
      currentCount,
      maxRequests: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - currentCount),
      windowSeconds: this.windowSeconds,
      algorithm: this.algorithm
    };
  }
}
