import redis from '../config/redis.js';

/**
 * Sliding Window Algorithm
 * - Combines current and previous window with weighted calculation
 * - Smoother than fixed window
 * - Prevents burst at window boundaries
 * - More accurate rate limiting
 * - Best for: Precise rate limiting with burst protection
 */
export class SlidingWindow {
  constructor(maxRequests = 10, windowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
    this.algorithm = 'sliding-window';
  }

  async isAllowed(identifier) {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const currentKey = `ratelimit:sliding:${identifier}:${currentWindow}`;
    const previousKey = `ratelimit:sliding:${identifier}:${previousWindow}`;

    // Get counts from both windows
    const [currentCount, previousCount] = await Promise.all([
      redis.get(currentKey),
      redis.get(previousKey)
    ]);

    const current = parseInt(currentCount || 0);
    const previous = parseInt(previousCount || 0);

    // Calculate position in current window (0 to 1)
    const windowStartTime = currentWindow * windowMs;
    const timeIntoWindow = now - windowStartTime;
    const percentageIntoWindow = timeIntoWindow / windowMs;

    // Weight previous window's requests that fall into our sliding window
    const weightedPrevious = previous * (1 - percentageIntoWindow);
    const estimatedCount = weightedPrevious + current;

    const allowed = estimatedCount < this.maxRequests;

    if (allowed) {
      // Increment current window counter
      const newCount = await redis.incr(currentKey);

      // Set expiry
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
        percentage: Math.round(percentageIntoWindow * 100)
      }
    };
  }

  async reset(identifier) {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const currentKey = `ratelimit:sliding:${identifier}:${currentWindow}`;
    const previousKey = `ratelimit:sliding:${identifier}:${previousWindow}`;

    await Promise.all([
      redis.del(currentKey),
      redis.del(previousKey)
    ]);
  }

  async getStats(identifier) {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const currentWindow = Math.floor(now / windowMs);
    const previousWindow = currentWindow - 1;

    const currentKey = `ratelimit:sliding:${identifier}:${currentWindow}`;
    const previousKey = `ratelimit:sliding:${identifier}:${previousWindow}`;

    const [currentCount, previousCount] = await Promise.all([
      redis.get(currentKey),
      redis.get(previousKey)
    ]);

    const current = parseInt(currentCount || 0);
    const previous = parseInt(previousCount || 0);

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
        percentageIntoWindow: Math.round(percentageIntoWindow * 100)
      }
    };
  }
}
