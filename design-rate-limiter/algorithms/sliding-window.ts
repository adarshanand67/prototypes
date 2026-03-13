import redis from '../config/redis.js';
import type { RateLimitResult } from './fixed-window.js';

export interface SlidingWindowStats {
  currentCount: number;
  maxRequests: number;
  remaining: number;
  windowSeconds: number;
  algorithm: string;
  details: {
    current: number;
    previous: number;
    weighted: number;
    percentageIntoWindow: number;
  };
}

export interface SlidingWindowResult extends RateLimitResult {
  weighted?: {
    current: number;
    previous: number;
    percentage: number;
  };
}

/**
 * Sliding Window Algorithm
 * - Combines current and previous window with weighted calculation
 * - Smoother than fixed window, prevents burst at window boundaries
 * - Best for: Precise rate limiting with burst protection
 */
export class SlidingWindow {
  readonly maxRequests: number;
  readonly windowSeconds: number;
  readonly algorithm = 'sliding-window';

  constructor(maxRequests: number = 10, windowSeconds: number = 60) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async isAllowed(identifier: string): Promise<SlidingWindowResult> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const currentKey = `ratelimit:sliding:${identifier}:${currentWindow}`;
    const previousKey = `ratelimit:sliding:${identifier}:${previousWindow}`;

    const [currentCount, previousCount] = await Promise.all([
      redis.get(currentKey),
      redis.get(previousKey),
    ]);

    const current = parseInt(currentCount ?? '0');
    const previous = parseInt(previousCount ?? '0');

    const windowStartTime = currentWindow * windowMs;
    const timeIntoWindow = now - windowStartTime;
    const percentageIntoWindow = timeIntoWindow / windowMs;

    const weightedPrevious = previous * (1 - percentageIntoWindow);
    const estimatedCount = weightedPrevious + current;

    const allowed = estimatedCount < this.maxRequests;

    if (allowed) {
      const newCount = await redis.incr(currentKey);
      if (newCount === 1) {
        await redis.expire(currentKey, this.windowSeconds * 2);
      }
    }

    const windowEnd = (currentWindow + 1) * windowMs;

    return {
      allowed,
      remaining: Math.max(0, Math.floor(this.maxRequests - estimatedCount)),
      resetAt: windowEnd,
      currentCount: Math.ceil(estimatedCount),
      algorithm: this.algorithm,
      weighted: {
        current,
        previous,
        percentage: Math.round(percentageIntoWindow * 100),
      },
    };
  }

  async reset(identifier: string): Promise<void> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    await Promise.all([
      redis.del(`ratelimit:sliding:${identifier}:${currentWindow}`),
      redis.del(`ratelimit:sliding:${identifier}:${previousWindow}`),
    ]);
  }

  async getStats(identifier: string): Promise<SlidingWindowStats> {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const [currentCount, previousCount] = await Promise.all([
      redis.get(`ratelimit:sliding:${identifier}:${currentWindow}`),
      redis.get(`ratelimit:sliding:${identifier}:${previousWindow}`),
    ]);

    const current = parseInt(currentCount ?? '0');
    const previous = parseInt(previousCount ?? '0');

    const windowStartTime = currentWindow * windowMs;
    const timeIntoWindow = now - windowStartTime;
    const percentageIntoWindow = timeIntoWindow / windowMs;
    const weightedPrevious = previous * (1 - percentageIntoWindow);
    const estimatedCount = weightedPrevious + current;

    return {
      currentCount: Math.ceil(estimatedCount),
      maxRequests: this.maxRequests,
      remaining: Math.max(0, Math.floor(this.maxRequests - estimatedCount)),
      windowSeconds: this.windowSeconds,
      algorithm: this.algorithm,
      details: {
        current,
        previous,
        weighted: Math.ceil(weightedPrevious),
        percentageIntoWindow: Math.round(percentageIntoWindow * 100),
      },
    };
  }
}
