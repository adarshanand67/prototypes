import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../server.js';
import { seedCustomers, getAllCustomers } from '../database/customers.js';
import redis from '../config/redis.js';

describe('Rate Limiter Tests', () => {
  let testApiKey;

  beforeEach(async () => {
    // Seed customers and get test API key
    seedCustomers(10);
    const customers = getAllCustomers();
    testApiKey = customers[0].apiKey;

    // Clear Redis before each test
    await redis.flushall();
  });

  describe('API Authentication', () => {
    test('should reject requests without API key', async () => {
      const res = await request(app).get('/api/leaky-bucket/data');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('API key required');
    });

    test('should reject invalid API key', async () => {
      const res = await request(app)
        .get('/api/leaky-bucket/data')
        .set('X-API-Key', 'invalid_key');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid API key');
    });

    test('should accept valid API key', async () => {
      const res = await request(app)
        .get('/api/leaky-bucket/data')
        .set('X-API-Key', testApiKey);
      expect(res.status).toBe(200);
    });
  });

  describe('Leaky Bucket Algorithm', () => {
    test('should allow requests within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .get('/api/leaky-bucket/data')
          .set('X-API-Key', testApiKey);
        expect(res.status).toBe(200);
        expect(res.body.rateLimit.algorithm).toBe('leaky-bucket');
      }
    });

    test('should block requests exceeding capacity', async () => {
      // Fill bucket
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/leaky-bucket/data')
          .set('X-API-Key', testApiKey);
      }

      // Should be blocked now
      const res = await request(app)
        .get('/api/leaky-bucket/data')
        .set('X-API-Key', testApiKey);
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Rate limit exceeded');
    });

    test('should have rate limit headers', async () => {
      const res = await request(app)
        .get('/api/leaky-bucket/data')
        .set('X-API-Key', testApiKey);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
      expect(res.headers['x-ratelimit-algorithm']).toBe('leaky-bucket');
    });
  });

  describe('Fixed Window Algorithm', () => {
    test('should allow requests within window', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .get('/api/fixed-window/data')
          .set('X-API-Key', testApiKey);
        expect(res.status).toBe(200);
        expect(res.body.rateLimit.algorithm).toBe('fixed-window');
      }
    });

    test('should block 11th request in window', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/fixed-window/data')
          .set('X-API-Key', testApiKey);
      }

      const res = await request(app)
        .get('/api/fixed-window/data')
        .set('X-API-Key', testApiKey);
      expect(res.status).toBe(429);
    });

    test('should track remaining requests', async () => {
      const res1 = await request(app)
        .get('/api/fixed-window/data')
        .set('X-API-Key', testApiKey);
      expect(res1.body.rateLimit.remaining).toBe(9);

      const res2 = await request(app)
        .get('/api/fixed-window/data')
        .set('X-API-Key', testApiKey);
      expect(res2.body.rateLimit.remaining).toBe(8);
    });
  });

  describe('Sliding Window Algorithm', () => {
    test('should allow requests within limit', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .get('/api/sliding-window/data')
          .set('X-API-Key', testApiKey);
        expect(res.status).toBe(200);
        expect(res.body.rateLimit.algorithm).toBe('sliding-window');
      }
    });

    test('should block excess requests', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/sliding-window/data')
          .set('X-API-Key', testApiKey);
      }

      const res = await request(app)
        .get('/api/sliding-window/data')
        .set('X-API-Key', testApiKey);
      expect(res.status).toBe(429);
    });

    test('should provide weighted calculation details', async () => {
      const res = await request(app)
        .get('/api/sliding-window/data')
        .set('X-API-Key', testApiKey);
      expect(res.body.rateLimit.weighted).toBeDefined();
      expect(res.body.rateLimit.weighted.percentage).toBeDefined();
    });
  });

  describe('Customer Endpoints', () => {
    test('should list customers without rate limiting', async () => {
      const res = await request(app).get('/customers');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10);
      expect(res.body.sample).toHaveLength(5);
    });

    test('should access customers multiple times', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app).get('/customers');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
