import type { Request, Response, NextFunction } from 'express';
import { LeakyBucket } from '../algorithms/leaky-bucket.js';
import { FixedWindow } from '../algorithms/fixed-window.js';
import { SlidingWindow } from '../algorithms/sliding-window.js';
import { getCustomerByApiKey, type Customer } from '../database/customers.js';

type Algorithm = 'leaky-bucket' | 'fixed-window' | 'sliding-window';

const rateLimiters = {
  'leaky-bucket': new LeakyBucket(10, 1),
  'fixed-window': new FixedWindow(10, 60),
  'sliding-window': new SlidingWindow(10, 60),
};

// Extend Express Request to include custom properties
declare global {
  namespace Express {
    interface Request {
      customer: Customer;
      rateLimit: Record<string, unknown>;
    }
  }
}

export function rateLimitMiddleware(algorithm: Algorithm = 'fixed-window') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = (req.headers['x-api-key'] as string | undefined) ?? (req.query.api_key as string | undefined);

    if (!apiKey) {
      res.status(401).json({
        error: 'API key required',
        message: 'Provide X-API-Key header or api_key query parameter',
      });
      return;
    }

    const customer = getCustomerByApiKey(apiKey);
    if (!customer) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const limiter = rateLimiters[algorithm];
    if (!limiter) {
      res.status(500).json({ error: 'Invalid rate limiting algorithm' });
      return;
    }

    const identifier = `${customer.id}`;
    const result = await limiter.isAllowed(identifier);

    const limit = 'maxRequests' in limiter ? limiter.maxRequests : (limiter as LeakyBucket).capacity;
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
    res.setHeader('X-RateLimit-Algorithm', result.algorithm);

    if (!result.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${new Date(result.resetAt).toISOString()}`,
        rateLimit: {
          limit,
          remaining: result.remaining,
          resetAt: result.resetAt,
          algorithm: result.algorithm,
        },
      });
      return;
    }

    req.customer = customer;
    req.rateLimit = result as Record<string, unknown>;

    next();
  };
}

export { rateLimiters };
