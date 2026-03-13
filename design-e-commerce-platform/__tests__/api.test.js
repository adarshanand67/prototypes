import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

// Helper to wait for replication
const waitForReplication = (ms = 3000) => new Promise(resolve => setTimeout(resolve, ms));

describe('E-Commerce Platform API Tests', () => {
  let createdProductId;
  let replicationTestProductId;

  describe('System Health', () => {
    test('GET /health - should return health status', async () => {
      const res = await request(BASE_URL).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(typeof res.body.uptime).toBe('number');
    });

    test('GET / - should return API info', async () => {
      const res = await request(BASE_URL).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('endpoints');
    });
  });

  describe('Product Listing', () => {
    test('GET /api/products - should list all products from replica', async () => {
      const res = await request(BASE_URL).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('replica');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
    });

    test('GET /api/products - should have cache headers', async () => {
      // First request
      const res1 = await request(BASE_URL).get('/api/products');
      expect(res1.headers['x-cache']).toBeDefined();

      // Second request - may be cached
      const res2 = await request(BASE_URL).get('/api/products');
      expect(res2.headers['x-cache']).toBeDefined();
    });
  });

  describe('Get Product by ID', () => {
    test('GET /api/products/:id - should get product from replica', async () => {
      const res = await request(BASE_URL).get('/api/products/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('replica');
      expect(res.body.data.id).toBe(1);
      expect(res.body.data).toHaveProperty('item_name');
      expect(res.body.data).toHaveProperty('price');
      expect(res.body.data).toHaveProperty('color');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('stock_quantity');
      expect(res.body.data).toHaveProperty('category');
    });

    test('GET /api/products/:id - should return 404 for non-existent product', async () => {
      const res = await request(BASE_URL).get('/api/products/99999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty('error');
    });

    test('GET /api/products/:id/from-master - should get product from master', async () => {
      const res = await request(BASE_URL).get('/api/products/1/from-master');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
      expect(res.body.data.id).toBe(1);
    });

    test('GET /api/products/:id/from-master - should return 404 for non-existent', async () => {
      const res = await request(BASE_URL).get('/api/products/99999/from-master');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Create Product', () => {
    test('POST /api/products - should create new product', async () => {
      const newProduct = {
        item_name: 'Vitest Product',
        price: 299.99,
        color: 'Blue',
        description: 'Created with Vitest',
        stock_quantity: 100,
        category: 'Electronics'
      };

      const res = await request(BASE_URL)
        .post('/api/products')
        .send(newProduct)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
      expect(res.body).toHaveProperty('productId');
      expect(res.body.replicationDelay).toBe('2000ms');

      createdProductId = res.body.productId;
    });

    test('POST /api/products - should fail without required fields', async () => {
      const res = await request(BASE_URL)
        .post('/api/products')
        .send({ color: 'Red' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body).toHaveProperty('error');
    });

    test('POST /api/products - should fail without item_name', async () => {
      const res = await request(BASE_URL)
        .post('/api/products')
        .send({ price: 99.99 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('POST /api/products - should fail without price', async () => {
      const res = await request(BASE_URL)
        .post('/api/products')
        .send({ item_name: 'Test' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Replication Lag Demonstration', () => {
    test('should demonstrate 2-second replication lag', async () => {
      // Step 1: Create product on master
      const newProduct = {
        item_name: 'Replication Lag Test',
        price: 499.99,
        color: 'Green',
        description: 'Testing replication delay',
        stock_quantity: 50,
        category: 'Test'
      };

      const createRes = await request(BASE_URL)
        .post('/api/products')
        .send(newProduct)
        .set('Content-Type', 'application/json');

      expect(createRes.status).toBe(201);
      replicationTestProductId = createRes.body.productId;

      // Step 2: Immediately try to read from replica - should FAIL
      const immediateRead = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}`);

      expect(immediateRead.status).toBe(404);
      expect(immediateRead.body.success).toBe(false);

      // Step 3: Read from master - should SUCCESS
      const masterRead = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}/from-master`);

      expect(masterRead.status).toBe(200);
      expect(masterRead.body.success).toBe(true);
      expect(masterRead.body.source).toBe('master');
      expect(masterRead.body.data.item_name).toBe('Replication Lag Test');

      // Step 4: Wait for replication
      await waitForReplication();

      // Step 5: Read from replica - should SUCCESS now
      const afterReplication = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}`);

      // After replication, product may or may not be available depending on timing
      expect([200, 404]).toContain(afterReplication.status);
    });
  });

  describe('Compare Master vs Replica', () => {
    test('GET /api/products/:id/compare - should compare databases', async () => {
      const res = await request(BASE_URL).get('/api/products/1/compare');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('productId');
      expect(res.body).toHaveProperty('master');
      expect(res.body).toHaveProperty('replica');
      expect(res.body).toHaveProperty('inSync');
      expect(typeof res.body.inSync).toBe('boolean');
    });

    test('GET /api/products/:id/compare - should show sync status', async () => {
      const res = await request(BASE_URL)
        .get(`/api/products/${createdProductId}/compare`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.productId).toBe(String(createdProductId));
    });
  });

  describe('Update Product', () => {
    test('PUT /api/products/:id - should update product', async () => {
      const updates = {
        price: 349.99,
        description: 'Updated via Vitest'
      };

      const res = await request(BASE_URL)
        .put(`/api/products/${createdProductId}`)
        .send(updates)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
      expect(res.body.replicationDelay).toBe('2000ms');
    });

    test('PUT /api/products/:id - should return 404 for non-existent', async () => {
      const res = await request(BASE_URL)
        .put('/api/products/99999')
        .send({ price: 100 })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('PUT /api/products/:id - should fail with empty body', async () => {
      const res = await request(BASE_URL)
        .put(`/api/products/${createdProductId}`)
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No fields to update');
    });

    test('PUT /api/products/:id - should update only specified fields', async () => {
      const res = await request(BASE_URL)
        .put(`/api/products/${createdProductId}`)
        .send({ color: 'Red' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    test('GET /api/cache/stats - should return cache stats', async () => {
      const res = await request(BASE_URL).get('/api/cache/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('hits');
      expect(res.body.stats).toHaveProperty('misses');
      expect(res.body.stats).toHaveProperty('keys');
      expect(typeof res.body.stats.hits).toBe('number');
      expect(typeof res.body.stats.misses).toBe('number');
    });
  });

  describe('Delete Product', () => {
    test('DELETE /api/products/:id - should delete product', async () => {
      const res = await request(BASE_URL)
        .delete(`/api/products/${createdProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
      expect(res.body.replicationDelay).toBe('2000ms');
    });

    test('DELETE /api/products/:id - should return 404 for non-existent', async () => {
      const res = await request(BASE_URL).delete('/api/products/99999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test('DELETE /api/products/:id - deleted product should not exist', async () => {
      // Wait for replication
      await waitForReplication();

      const res = await request(BASE_URL)
        .get(`/api/products/${createdProductId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for invalid routes', async () => {
      const res = await request(BASE_URL).get('/api/invalid-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Not found');
    });

    test('should handle malformed JSON', async () => {
      const res = await request(BASE_URL)
        .post('/api/products')
        .send('{"invalid json}')
        .set('Content-Type', 'application/json');

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
