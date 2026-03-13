import express from 'express';
import { masterPool, replicaPool, replicateToSlave } from '../config/database.js';
import { cacheMiddleware, clearCache } from '../middleware/cache.js';

const router = express.Router();

// Get all products (from REPLICA with caching)
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    const [rows] = await replicaPool.execute('SELECT * FROM products');
    res.json({
      success: true,
      source: 'replica',
      count: rows.length,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product by ID (from REPLICA with caching)
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const [rows] = await replicaPool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found in replica'
      });
    }

    res.json({
      success: true,
      source: 'replica',
      data: rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get product by ID from MASTER (to show replication lag)
router.get('/:id/from-master', async (req, res) => {
  try {
    const [rows] = await masterPool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found in master'
      });
    }

    res.json({
      success: true,
      source: 'master',
      data: rows[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new product (WRITE to MASTER, replicate to REPLICA)
router.post('/', async (req, res) => {
  try {
    const { item_name, price, color, description, stock_quantity, category } = req.body;

    if (!item_name || !price) {
      return res.status(400).json({
        success: false,
        error: 'item_name and price are required'
      });
    }

    const query = `INSERT INTO products (item_name, price, color, description, stock_quantity, category)
                   VALUES (?, ?, ?, ?, ?, ?)`;
    const values = [item_name, price, color || null, description || null, stock_quantity || 0, category || null];

    // Write to MASTER
    const [result] = await masterPool.execute(query, values);

    // Simulate replication delay
    console.log('⏳ Replicating to slave database...');
    replicateToSlave(query, values);

    // Clear cache
    clearCache('/products');

    res.status(201).json({
      success: true,
      message: 'Product created in master, replicating to slave...',
      source: 'master',
      productId: result.insertId,
      replicationDelay: `${process.env.REPLICATION_LAG}ms`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product (WRITE to MASTER, replicate to REPLICA)
router.put('/:id', async (req, res) => {
  try {
    const { item_name, price, color, description, stock_quantity, category } = req.body;
    const updates = [];
    const values = [];

    if (item_name !== undefined) {
      updates.push('item_name = ?');
      values.push(item_name);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (stock_quantity !== undefined) {
      updates.push('stock_quantity = ?');
      values.push(stock_quantity);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(req.params.id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;

    // Update MASTER
    const [result] = await masterPool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Simulate replication delay
    console.log('⏳ Replicating update to slave database...');
    replicateToSlave(query, values);

    // Clear cache
    clearCache('/products');

    res.json({
      success: true,
      message: 'Product updated in master, replicating to slave...',
      source: 'master',
      replicationDelay: `${process.env.REPLICATION_LAG}ms`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product (WRITE to MASTER, replicate to REPLICA)
router.delete('/:id', async (req, res) => {
  try {
    const query = 'DELETE FROM products WHERE id = ?';
    const values = [req.params.id];

    // Delete from MASTER
    const [result] = await masterPool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Simulate replication delay
    console.log('⏳ Replicating delete to slave database...');
    replicateToSlave(query, values);

    // Clear cache
    clearCache('/products');

    res.json({
      success: true,
      message: 'Product deleted from master, replicating to slave...',
      source: 'master',
      replicationDelay: `${process.env.REPLICATION_LAG}ms`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Compare product between master and replica (shows replication lag)
router.get('/:id/compare', async (req, res) => {
  try {
    const [masterRows] = await masterPool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );
    const [replicaRows] = await replicaPool.execute(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      productId: req.params.id,
      master: masterRows[0] || null,
      replica: replicaRows[0] || null,
      inSync: JSON.stringify(masterRows[0]) === JSON.stringify(replicaRows[0])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
