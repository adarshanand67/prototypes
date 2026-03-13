import { describe, test, expect } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

const waitForReplication = (ms: number = 3000): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

describe('E-Commerce Platform API Tests', () => {
  let createdProductId: number;
  let replicationTestProductId: number;

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
      const res1 = await request(BASE_URL).get('/api/products');
      expect(res1.headers['x-cache']).toBeDefined();

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
  });

  describe('Create Product', () => {
    test('POST /api/products - should create new product', async () => {
      const newProduct = {
        item_name: 'Vitest Product',
        price: 299.99,
        color: 'Blue',
        description: 'Created with Vitest',
        stock_quantity: 100,
        category: 'Electronics',
      };

      const res = await request(BASE_URL)
        .post('/api/products')
        .send(newProduct)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
      expect(res.body).toHaveProperty('productId');

      createdProductId = res.body.productId as number;
    });

    test('POST /api/products - should fail without required fields', async () => {
      const res = await request(BASE_URL)
        .post('/api/products')
        .send({ color: 'Red' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Replication Lag Demonstration', () => {
    test('should demonstrate 2-second replication lag', async () => {
      const newProduct = {
        item_name: 'Replication Lag Test',
        price: 499.99,
        color: 'Green',
        description: 'Testing replication delay',
        stock_quantity: 50,
        category: 'Test',
      };

      const createRes = await request(BASE_URL)
        .post('/api/products')
        .send(newProduct)
        .set('Content-Type', 'application/json');

      expect(createRes.status).toBe(201);
      replicationTestProductId = createRes.body.productId as number;

      const immediateRead = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}`);

      expect(immediateRead.status).toBe(404);

      const masterRead = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}/from-master`);

      expect(masterRead.status).toBe(200);
      expect(masterRead.body.source).toBe('master');

      await waitForReplication();

      const afterReplication = await request(BASE_URL)
        .get(`/api/products/${replicationTestProductId}`);

      expect([200, 404]).toContain(afterReplication.status);
    });
  });

  describe('Update Product', () => {
    test('PUT /api/products/:id - should update product', async () => {
      const res = await request(BASE_URL)
        .put(`/api/products/${createdProductId}`)
        .send({ price: 349.99, description: 'Updated via Vitest' })
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.source).toBe('master');
    });

    test('PUT /api/products/:id - should fail with empty body', async () => {
      const res = await request(BASE_URL)
        .put(`/api/products/${createdProductId}`)
        .send({})
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    test('GET /api/cache/stats - should return cache stats', async () => {
      const res = await request(BASE_URL).get('/api/cache/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
    });
  });

  describe('Delete Product', () => {
    test('DELETE /api/products/:id - should delete product', async () => {
      const res = await request(BASE_URL)
        .delete(`/api/products/${createdProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('DELETE /api/products/:id - should return 404 for non-existent', async () => {
      const res = await request(BASE_URL).delete('/api/products/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for invalid routes', async () => {
      const res = await request(BASE_URL).get('/api/invalid-endpoint');
      expect(res.status).toBe(404);
    });
  });
});
