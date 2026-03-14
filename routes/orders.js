const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

function getOrderWithItems(orderId) {
  const order = db.prepare(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return { ...order, items };
}

// GET /api/orders
router.get('/', authenticate, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    ORDER BY o.created_at DESC LIMIT 100
  `).all();
  const result = orders.map(o => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    return { ...o, items };
  });
  res.json(result);
});

// GET /api/orders/kitchen  (no auth — kitchen display runs without login)
router.get('/kitchen', (req, res) => {
  const orders = db.prepare(`
    SELECT DISTINCT o.*, t.name as table_name, t.number as table_number
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    INNER JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE o.status IN ('new', 'preparing')
      AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
    ORDER BY o.created_at ASC
  `).all();
  const kitchenItems = db.prepare(`
    SELECT oi.* FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE oi.order_id = ?
      AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
  `);
  const result = orders.map(o => ({ ...o, items: kitchenItems.all(o.id) }));
  console.log(`[KITCHEN] ${new Date().toISOString()} — ${result.length} active order(s):`, result.map(o => `#${o.id} ${o.status} table=${o.table_number || 'Counter'} (${o.items.length} items)`));
  res.json(result);
});

// GET /api/orders/pending-till — customer orders awaiting cashier payment (no auth — POS needs this)
router.get('/pending-till', authenticate, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.source = 'customer'
      AND o.status NOT IN ('completed')
    ORDER BY o.created_at ASC
  `).all();
  const result = orders.map(o => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
    return { ...o, items };
  });
  res.json(result);
});

// GET /api/orders/test-kitchen
router.get('/test-kitchen', (req, res) => {
  const meal = db.prepare('SELECT * FROM meals WHERE active = 1 LIMIT 1').get();
  if (!meal) return res.status(400).json({ error: 'No active meals found.' });
  const table = db.prepare('SELECT * FROM tables WHERE active = 1 LIMIT 1').get();

  const orderResult = db.prepare(
    "INSERT INTO orders (table_id, status, type, source) VALUES (?, 'new', 'dine-in', 'customer')"
  ).run(table ? table.id : null);
  const orderId = orderResult.lastInsertRowid;
  db.prepare(
    'INSERT INTO order_items (order_id, product_id, meal_id, quantity, unit_price, name) VALUES (?, NULL, ?, 1, ?, ?)'
  ).run(orderId, meal.id, meal.price, meal.name);

  if (table) {
    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table.id);
  }

  const order = getOrderWithItems(orderId);
  console.log(`[TEST-KITCHEN] Created test order #${orderId} with meal "${meal.name}" on table ${table ? table.name : 'none'}`);
  res.json({ message: 'Test order created', order });
});

// GET /api/orders/table/:tableNumber
router.get('/table/:tableNumber', (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE number = ?').get(parseInt(req.params.tableNumber));
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const order = db.prepare(`
    SELECT o.*, t.name as table_name, t.number as table_number
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.table_id = ? AND o.status NOT IN ('completed')
    ORDER BY o.created_at DESC LIMIT 1
  `).get(table.id);
  if (!order) return res.json(null);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

// POST /api/orders — enforces table for customer source, checks occupancy, locks table
router.post('/', (req, res) => {
  const { table_id, items, type, source } = req.body;
  const orderSource = source || 'pos';

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items are required' });
  }

  // ENFORCE: customer orders must have a table
  if (orderSource === 'customer' && !table_id) {
    return res.status(400).json({ error: 'Table number is required. Please scan the QR code from your table.' });
  }

  // ENFORCE: check table status for customer orders
  if (orderSource === 'customer' && table_id) {
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(table_id);
    if (!table) return res.status(404).json({ error: 'Table not found' });
    if (table.status === 'occupied' || table.status === 'bill-requested') {
      return res.status(409).json({ error: 'This table is currently occupied. Please ask a staff member for assistance.' });
    }
  }

  const orderResult = db.prepare(
    'INSERT INTO orders (table_id, status, type, source) VALUES (?, ?, ?, ?)'
  ).run(table_id || null, 'new', type || 'dine-in', orderSource);
  const orderId = orderResult.lastInsertRowid;

  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, meal_id, quantity, unit_price, name) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  const insertMovement = db.prepare(
    'INSERT INTO stock_movements (product_id, quantity, type, note) VALUES (?, ?, ?, ?)'
  );

  for (const item of items) {
    insertItem.run(orderId, item.product_id || null, item.meal_id || null, item.quantity, item.unit_price, item.name);
    if (item.product_id) {
      decrementStock.run(item.quantity, item.product_id, item.quantity);
      insertMovement.run(item.product_id, -item.quantity, 'sale', `Order #${orderId}`);
    }
  }

  // ENFORCE: lock table when customer places first order
  if (orderSource === 'customer' && table_id) {
    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
    console.log(`[TABLE] Table #${table_id} locked → occupied (Order #${orderId})`);
  }

  // Verify kitchen items are present (server-side check)
  const kitchenItemCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE oi.order_id = ? AND (oi.meal_id IS NOT NULL OR c.sends_to_kitchen = 1)
  `).get(orderId);

  console.log(`[ORDER] #${orderId} created | source=${orderSource} table=${table_id || 'none'} items=${items.length} kitchen_items=${kitchenItemCount.cnt}`);

  const order = getOrderWithItems(orderId);
  res.status(201).json(order);
});

// PUT /api/orders/:id/status  (no auth — kitchen display runs without login)
router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'preparing', 'ready', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?").run(status, order.id);
  const updated = getOrderWithItems(order.id);
  res.json(updated);
});

module.exports = router;
