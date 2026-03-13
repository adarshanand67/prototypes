import express from 'express';
import dotenv from 'dotenv';
import productsRouter from './routes/products.js';
import { getCacheStats } from './middleware/cache.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/products', productsRouter);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
// Cache stats endpoint
app.get('/api/cache/stats', (req, res) => {
    res.json({
        success: true,
        stats: getCacheStats()
    });
});
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'E-Commerce Platform API',
        version: '1.0.0',
        endpoints: {
            products: {
                'GET /api/products': 'List all products (from replica with cache)',
                'GET /api/products/:id': 'Get product by ID (from replica with cache)',
                'GET /api/products/:id/from-master': 'Get product from master database',
                'GET /api/products/:id/compare': 'Compare product between master and replica',
                'POST /api/products': 'Create new product (writes to master)',
                'PUT /api/products/:id': 'Update product (writes to master)',
                'DELETE /api/products/:id': 'Delete product (writes to master)'
            },
            system: {
                'GET /health': 'Health check',
                'GET /api/cache/stats': 'Cache statistics'
            }
        },
        database: {
            master: {
                host: process.env.MASTER_DB_HOST,
                port: process.env.MASTER_DB_PORT,
                database: process.env.MASTER_DB_NAME
            },
            replica: {
                host: process.env.REPLICA_DB_HOST,
                port: process.env.REPLICA_DB_PORT,
                database: process.env.REPLICA_DB_NAME
            },
            replicationLag: `${process.env.REPLICATION_LAG}ms`
        }
    });
});
// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found'
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Master DB: ${process.env.MASTER_DB_HOST}:${process.env.MASTER_DB_PORT}`);
    console.log(`📊 Replica DB: ${process.env.REPLICA_DB_HOST}:${process.env.REPLICA_DB_PORT}`);
    console.log(`⏱️  Replication lag: ${process.env.REPLICATION_LAG}ms`);
});
//# sourceMappingURL=server.js.map