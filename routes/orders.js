const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');

async function getOrderWithItems(db, orderId) {
  const order = await db.get(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.id = ?
  `, [orderId]);
  if (!order) return null;
  const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return { ...order, items };
}

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const orders = await db.all(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    ORDER BY o.created_at DESC LIMIT 100
  `);
  const result = await Promise.all(orders.map(async o => {
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    return { ...o, items };
  }));
  res.json(result);
});

// GET /api/orders/kitchen  (no auth — kitchen display runs without login)
router.get('/kitchen', async (req, res) => {
  const db = getDb();
  const orders = await db.all(`
    SELECT DISTINCT o.*, t.name as table_name, t.number as table_number
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    INNER JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.status IN ('new', 'preparing')
      AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
    ORDER BY o.created_at ASC
  `);
  const result = await Promise.all(orders.map(async o => {
    const items = await db.all(`
      SELECT oi.* FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE oi.order_id = ?
        AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
    `, [o.id]);
    return { ...o, items };
  }));
  console.log(`[KITCHEN] ${new Date().toISOString()} — ${result.length} active order(s):`, result.map(o => `#${o.id} ${o.status} table=${o.table_number || 'Counter'} (${o.items.length} items)`));
  res.json(result);
});

// GET /api/orders/pending-till — customer orders awaiting cashier payment
router.get('/pending-till', authenticate, async (req, res) => {
  const db = getDb();
  const orders = await db.all(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.source = 'customer'
      AND o.status NOT IN ('completed')
    ORDER BY o.created_at ASC
  `);
  const result = await Promise.all(orders.map(async o => {
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    return { ...o, items };
  }));
  res.json(result);
});

// GET /api/orders/test-kitchen
router.get('/test-kitchen', async (req, res) => {
  const db = getDb();
  const meal = await db.get('SELECT * FROM meals WHERE active = 1 LIMIT 1');
  if (!meal) return res.status(400).json({ error: 'No active meals found.' });
  const table = await db.get('SELECT * FROM tables WHERE active = 1 LIMIT 1');

  const orderResult = await db.run(
    "INSERT INTO orders (table_id, status, type, source) VALUES (?, 'new', 'dine-in', 'customer')",
    [table ? table.id : null]
  );
  const orderId = orderResult.lastID;
  await db.run(
    'INSERT INTO order_items (order_id, product_id, meal_id, quantity, unit_price, name) VALUES (?, NULL, ?, 1, ?, ?)',
    [orderId, meal.id, meal.price, meal.name]
  );

  if (table) {
    await db.run("UPDATE tables SET status = 'occupied' WHERE id = ?", [table.id]);
  }

  const order = await getOrderWithItems(db, orderId);
  console.log(`[TEST-KITCHEN] Created test order #${orderId} with meal "${meal.name}" on table ${table ? table.name : 'none'}`);
  res.json({ message: 'Test order created', order });
});

// GET /api/orders/table/:tableNumber
router.get('/table/:tableNumber', async (req, res) => {
  const db = getDb();
  const table = await db.get('SELECT * FROM tables WHERE number = ?', [parseInt(req.params.tableNumber)]);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const order = await db.get(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.table_id = ? AND o.status NOT IN ('completed')
    ORDER BY o.created_at DESC LIMIT 1
  `, [table.id]);
  if (!order) return res.json(null);
  const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.json({ ...order, items });
});

// POST /api/orders — enforces table for customer source, checks occupancy, locks table
router.post('/', async (req, res) => {
  const { table_id, items, type, source } = req.body;
  const orderSource = source || 'pos';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  if (orderSource === 'customer' && !table_id) {
    return res.status(400).json({ error: 'Table number is required. Please scan the QR code from your table.' });
  }

  const db = getDb();

  if (orderSource === 'customer' && table_id) {
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [table_id]);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    if (table.status === 'occupied' || table.status === 'bill-requested') {
      return res.status(409).json({ error: 'This table is currently occupied. Please ask a staff member for assistance.' });
    }
  }

  const orderResult = await db.run(
    'INSERT INTO orders (table_id, status, type, source) VALUES (?, ?, ?, ?)',
    [table_id || null, 'new', type || 'dine-in', orderSource]
  );
  const orderId = orderResult.lastID;

  for (const item of items) {
    await db.run(
      'INSERT INTO order_items (order_id, product_id, meal_id, quantity, unit_price, name) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, item.product_id || null, item.meal_id || null, item.quantity, item.unit_price, item.name]
    );
    if (item.product_id) {
      await db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.product_id, item.quantity]);
      await db.run(
        'INSERT INTO stock_movements (product_id, quantity, type, note) VALUES (?, ?, ?, ?)',
        [item.product_id, -item.quantity, 'sale', `Order #${orderId}`]
      );
    }
  }

  if (orderSource === 'customer' && table_id) {
    await db.run("UPDATE tables SET status = 'occupied' WHERE id = ?", [table_id]);
    console.log(`[TABLE] Table #${table_id} locked → occupied (Order #${orderId})`);
  }

  const kitchenItemCount = await db.get(`
    SELECT COUNT(*) as cnt FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE oi.order_id = ? AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
  `, [orderId]);

  console.log(`[ORDER] #${orderId} created | source=${orderSource} table=${table_id || 'none'} items=${items.length} kitchen_items=${kitchenItemCount.cnt}`);

  const order = await getOrderWithItems(db, orderId);
  res.status(201).json(order);
});

// PUT /api/orders/:id/status  (no auth — kitchen display runs without login)
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'preparing', 'ready', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const db = getDb();
  const order = await db.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  await db.run("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?", [status, order.id]);
  const updated = await getOrderWithItems(db, order.id);
  res.json(updated);
});

module.exports = router;
