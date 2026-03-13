import redis from '../config/redis.js';

/**
 * Leaky Bucket Algorithm
 * - Requests "leak" out at a constant rate
 * - Burst requests are queued if bucket has capacity
 * - Smooths out traffic spikes
 * - Best for: Stable, predictable request processing
 */
export class LeakyBucket {
  constructor(capacity = 10, leakRate = 1) {
    this.capacity = capacity; // Max requests in bucket
    this.leakRate = leakRate; // Requests leaked per second
    this.algorithm = 'leaky-bucket';
  }

  async isAllowed(identifier) {
    const key = `ratelimit:leaky:${identifier}`;
    const now = Date.now();
    const leakInterval = 1000 / this.leakRate; // ms between leaks

    // Get current bucket state
    const bucketData = await redis.get(key);
    let bucket = bucketData ? JSON.parse(bucketData) : {
      count: 0,
      lastLeak: now
    };

    // Calculate leaked requests since last check
    const timePassed = now - bucket.lastLeak;
    const leakedRequests = Math.floor(timePassed / leakInterval);

    // Update bucket
    bucket.count = Math.max(0, bucket.count - leakedRequests);
    bucket.lastLeak = now;

    // Check if bucket has capacity
    if (bucket.count < this.capacity) {
      bucket.count++;
      await redis.setex(key, 60, JSON.stringify(bucket));
      return {
        allowed: true,
        remaining: this.capacity - bucket.count,
        resetAt: now + (bucket.count * leakInterval),
        algorithm: this.algorithm
      };
    }

    await redis.setex(key, 60, JSON.stringify(bucket));
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + ((bucket.count - this.capacity + 1) * leakInterval),
      algorithm: this.algorithm
    };
  }

  async reset(identifier) {
    const key = `ratelimit:leaky:${identifier}`;
    await redis.del(key);
  }

  async getStats(identifier) {
    const key = `ratelimit:leaky:${identifier}`;
    const data = await redis.get(key);
    if (!data) return null;

    const bucket = JSON.parse(data);
    const now = Date.now();
    const leakInterval = 1000 / this.leakRate;
    const timePassed = now - bucket.lastLeak;
    const leakedRequests = Math.floor(timePassed / leakInterval);
    const currentCount = Math.max(0, bucket.count - leakedRequests);

    return {
      currentCount,
      capacity: this.capacity,
      leakRate: this.leakRate,
      remaining: this.capacity - currentCount,
      algorithm: this.algorithm
    };
  }
}
