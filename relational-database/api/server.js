import express from 'express';
import { poolPrimary, poolReplica, getShardPool } from './db.js';

const app = express();
app.use(express.json());

// ==========================================
// 1. REPLICA ROUTING DEMONSTRATION
// ==========================================

// WRITE ROUTE - Goes to Primary Database
app.post('/api/users', async (req, res) => {
    const { username, email } = req.body;
    try {
        console.log('[WRITE] Routing POST /api/users to PRIMARY database');
        const result = await poolPrimary.query(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
            [username, email]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// READ ROUTE - Goes to Replica Database
app.get('/api/users', async (req, res) => {
    try {
        console.log('[READ] Routing GET /api/users to REPLICA database');
        const result = await poolReplica.query('SELECT * FROM users ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. SHARDING DEMONSTRATION
// ==========================================

// WRITE ROUTE - Chooses Shard dynamically
app.post('/api/shards/posts', async (req, res) => {
    const { user_id, content } = req.body;
    try {
        // Shard Routing Logic Based on user_id
        const targetShard = getShardPool(user_id);

        console.log(`[WRITE-SHARD] Connecting to shard for user ${user_id}`);
        const result = await targetShard.query(
            'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
            [user_id, content]
        );
        res.status(201).json({
            shard_routed: (user_id % 2) + 1,
            data: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// READ ROUTE - Chooses Shard dynamically
app.get('/api/shards/posts/:user_id', async (req, res) => {
    const { user_id } = req.params;
    try {
        // Shard Routing Logic Based on user_id
        const targetShard = getShardPool(user_id);

        console.log(`[READ-SHARD] Querying shard for user ${user_id}`);
        const result = await targetShard.query(
            'SELECT * FROM posts WHERE user_id = $1 ORDER BY id DESC',
            [user_id]
        );
        res.json({
            shard_queried: (user_id % 2) + 1,
            count: result.rowCount,
            data: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
    console.log('Demonstrating Read Replicas & Database Sharding Routing');
});
