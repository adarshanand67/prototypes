import express from 'express';
import dotenv from 'dotenv';
import { rateLimitMiddleware } from './middleware/rate-limiter.js';
import { seedCustomers, getAllCustomers } from './database/customers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Seed customers on startup
seedCustomers(100);

// Routes without rate limiting
app.get('/', (req, res) => {
  res.json({
    service: 'Rate Limiter Demo',
    algorithms: ['leaky-bucket', 'fixed-window', 'sliding-window'],
    endpoints: {
      '/api/leaky-bucket/data': 'Protected by Leaky Bucket',
      '/api/fixed-window/data': 'Protected by Fixed Window',
      '/api/sliding-window/data': 'Protected by Sliding Window',
      '/customers': 'List all customers (no rate limit)'
    },
    usage: 'Add X-API-Key header or api_key query parameter'
  });
});

app.get('/customers', (req, res) => {
  const customers = getAllCustomers();
  res.json({
    total: customers.length,
    sample: customers.slice(0, 5).map(c => ({
      id: c.id,
      name: c.name,
      apiKey: c.apiKey,
      tier: c.tier
    })),
    message: 'Use any apiKey to test rate limiting'
  });
});

// Leaky Bucket protected routes
app.get('/api/leaky-bucket/data', rateLimitMiddleware('leaky-bucket'), (req, res) => {
  res.json({
    message: 'Success! Protected by Leaky Bucket',
    customer: req.customer.name,
    rateLimit: req.rateLimit,
    data: { timestamp: Date.now(), value: Math.random() }
  });
});

// Fixed Window protected routes
app.get('/api/fixed-window/data', rateLimitMiddleware('fixed-window'), (req, res) => {
  res.json({
    message: 'Success! Protected by Fixed Window',
    customer: req.customer.name,
    rateLimit: req.rateLimit,
    data: { timestamp: Date.now(), value: Math.random() }
  });
});

// Sliding Window protected routes
app.get('/api/sliding-window/data', rateLimitMiddleware('sliding-window'), (req, res) => {
  res.json({
    message: 'Success! Protected by Sliding Window',
    customer: req.customer.name,
    rateLimit: req.rateLimit,
    data: { timestamp: Date.now(), value: Math.random() }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Rate Limiter Service running on http://localhost:${PORT}`);
  console.log(`📊 Customers seeded: 100`);
  console.log(`🔒 Algorithms: Leaky Bucket, Fixed Window, Sliding Window`);
});

export default app;
