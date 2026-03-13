import { LeakyBucket } from '../algorithms/leaky-bucket.js';
import { FixedWindow } from '../algorithms/fixed-window.js';
import { SlidingWindow } from '../algorithms/sliding-window.js';
import { getCustomerByApiKey } from '../database/customers.js';

// Initialize rate limiters
const rateLimiters = {
  'leaky-bucket': new LeakyBucket(10, 1),      // 10 capacity, 1 req/sec leak rate
  'fixed-window': new FixedWindow(10, 60),     // 10 requests per 60 seconds
  'sliding-window': new SlidingWindow(10, 60)  // 10 requests per 60 seconds
};

export function rateLimitMiddleware(algorithm = 'fixed-window') {
  return async (req, res, next) => {
    // Get API key from header or query
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Provide X-API-Key header or api_key query parameter'
      });
    }

    // Validate customer
    const customer = getCustomerByApiKey(apiKey);
    if (!customer) {
      return res.status(401).json({
        error: 'Invalid API key'
      });
    }

    // Check rate limit
    const limiter = rateLimiters[algorithm];
    if (!limiter) {
      return res.status(500).json({
        error: 'Invalid rate limiting algorithm'
      });
    }

    const identifier = `${customer.id}`;
    const result = await limiter.isAllowed(identifier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter.maxRequests || limiter.capacity);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
    res.setHeader('X-RateLimit-Algorithm', result.algorithm);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${new Date(result.resetAt).toISOString()}`,
        rateLimit: {
          limit: limiter.maxRequests || limiter.capacity,
          remaining: result.remaining,
          resetAt: result.resetAt,
          algorithm: result.algorithm
        }
      });
    }

    // Attach customer and rate limit info to request
    req.customer = customer;
    req.rateLimit = result;

    next();
  };
}

export { rateLimiters };
