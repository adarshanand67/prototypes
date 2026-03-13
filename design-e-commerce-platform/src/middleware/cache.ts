import NodeCache from 'node-cache';
import type { Request, Response, NextFunction } from 'express';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

export function cacheMiddleware(duration: number = 300) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get<unknown>(key);

    if (cachedResponse !== undefined) {
      console.log(`🎯 Cache HIT for ${key}`);
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedResponse);
      return;
    }

    console.log(`❌ Cache MISS for ${key}`);
    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      cache.set(key, body, duration);
      return originalJson(body);
    };

    next();
  };
}

export function clearCache(pattern: string): void {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
  console.log(`🗑️  Cleared ${matchingKeys.length} cache entries matching: ${pattern}`);
}

export function getCacheStats(): NodeCache.Stats {
  return cache.getStats();
}

export { cache };
