import NodeCache from 'node-cache';

// Initialize cache with 5 minute TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

// Cache middleware
export function cacheMiddleware(duration = 300) {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`🎯 Cache HIT for ${key}`);
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    console.log(`❌ Cache MISS for ${key}`);
    res.setHeader('X-Cache', 'MISS');

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      cache.set(key, body, duration);
      return originalJson(body);
    };

    next();
  };
}

// Clear cache for specific pattern
export function clearCache(pattern) {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
  console.log(`🗑️  Cleared ${matchingKeys.length} cache entries matching: ${pattern}`);
}

// Get cache stats
export function getCacheStats() {
  return cache.getStats();
}

export { cache };
