import redis from '../config/redis.js';
import type { RateLimitResult } from './fixed-window.js';

interface BucketState {
  count: number;
  lastLeak: number;
}

/**
 * Leaky Bucket Algorithm
 * - Requests "leak" out at a constant rate
 * - Burst requests are queued if bucket has capacity
 * - Smooths out traffic spikes
 * - Best for: Stable, predictable request processing
 */
export class LeakyBucket {
  readonly capacity: number;
  readonly leakRate: number;
  readonly algorithm = 'leaky-bucket';

  constructor(capacity: number = 10, leakRate: number = 1) {
    this.capacity = capacity;
    this.leakRate = leakRate;
  }

  async isAllowed(identifier: string): Promise<RateLimitResult> {
    const key = `ratelimit:leaky:${identifier}`;
    const now = Date.now();
    const leakInterval = 1000 / this.leakRate;

    const bucketData = await redis.get(key);
    let bucket: BucketState = bucketData
      ? (JSON.parse(bucketData) as BucketState)
      : { count: 0, lastLeak: now };

    const timePassed = now - bucket.lastLeak;
    const leakedRequests = Math.floor(timePassed / leakInterval);

    bucket.count = Math.max(0, bucket.count - leakedRequests);
    bucket.lastLeak = now;

    if (bucket.count < this.capacity) {
      bucket.count++;
      await redis.setex(key, 60, JSON.stringify(bucket));
      return {
        allowed: true,
        remaining: this.capacity - bucket.count,
        resetAt: now + (bucket.count * leakInterval),
        algorithm: this.algorithm,
      };
    }

    await redis.setex(key, 60, JSON.stringify(bucket));
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + ((bucket.count - this.capacity + 1) * leakInterval),
      algorithm: this.algorithm,
    };
  }

  async reset(identifier: string): Promise<void> {
    await redis.del(`ratelimit:leaky:${identifier}`);
  }

  async getStats(identifier: string): Promise<{
    currentCount: number;
    capacity: number;
    leakRate: number;
    remaining: number;
    algorithm: string;
  } | null> {
    const data = await redis.get(`ratelimit:leaky:${identifier}`);
    if (!data) return null;

    const bucket = JSON.parse(data) as BucketState;
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
      algorithm: this.algorithm,
    };
  }
}
