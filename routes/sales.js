const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

// GET /api/sales
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const sales = await db.all(`
    SELECT s.*, o.type as order_type, o.table_id,
           t.name as table_name, t.number as table_number
    FROM sales s
    JOIN orders o ON s.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    ORDER BY s.created_at DESC
    LIMIT 200
  `);
  res.json(sales);
});

// POST /api/sales
router.post('/', authenticate, async (req, res) => {
  const { order_id, total, payment_method, till_number } = req.body;
  if (!order_id || total === undefined) {
    return res.status(400).json({ error: 'order_id and total are required' });
  }
  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [order_id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const result = await db.run(
    'INSERT INTO sales (order_id, total, payment_method, till_number) VALUES (?, ?, ?, ?)',
    [order_id, parseFloat(total), payment_method || 'cash', till_number || null]
  );

  const hasKitchenItems = await db.get(`
    SELECT COUNT(*) as cnt FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE oi.order_id = ?
      AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
  `, [order_id]);

  const isPosOrder = order.source === 'pos' || !order.source;
  if (hasKitchenItems.cnt === 0 || !isPosOrder) {
    await db.run("UPDATE orders SET status='completed', updated_at=datetime('now') WHERE id=?", [order_id]);
  }

  const sale = await db.get(`
    SELECT s.*, o.type as order_type, t.name as table_name
    FROM sales s JOIN orders o ON s.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id WHERE s.id = ?
  `, [result.lastID]);
  res.status(201).json(sale);
});

// GET /api/sales/today
router.get('/today', authenticate, async (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const summary = await db.get(`
    SELECT COUNT(*) as order_count, SUM(total) as total_revenue,
           AVG(total) as avg_order_value
    FROM sales WHERE date(created_at) = ?
  `, [today]);
  const byMethod = await db.all(`
    SELECT payment_method, COUNT(*) as count, SUM(total) as total
    FROM sales WHERE date(created_at) = ?
    GROUP BY payment_method
  `, [today]);
  res.json({ ...summary, by_method: byMethod, date: today });
});

module.exports = router;
