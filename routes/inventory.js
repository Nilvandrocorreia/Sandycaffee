const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// GET /api/inventory
router.get('/', authenticate, async (req, res) => {
  const db = getDb();
  const products = await db.all(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
    ORDER BY c.name, p.name
  `);
  res.json(products);
});

// PUT /api/inventory/:productId/restock
router.put('/:productId/restock', authenticate, async (req, res) => {
  const { quantity, note } = req.body;
  if (!quantity || parseInt(quantity) <= 0) {
    return res.status(400).json({ error: 'Valid quantity required' });
  }
  const db = getDb();
  const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.productId]);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  await db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [parseInt(quantity), product.id]);
  await db.run(
    'INSERT INTO stock_movements (product_id, quantity, type, note) VALUES (?, ?, ?, ?)',
    [product.id, parseInt(quantity), 'restock', note || 'Manual restock']
  );

  const updated = await db.get('SELECT * FROM products WHERE id = ?', [product.id]);
  res.json(updated);
});

// GET /api/inventory/movements
router.get('/movements', authenticate, async (req, res) => {
  const db = getDb();
  const movements = await db.all(`
    SELECT sm.*, p.name as product_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    ORDER BY sm.created_at DESC
    LIMIT 200
  `);
  res.json(movements);
});

// GET /api/inventory/report/pdf
router.get('/report/pdf', authenticate, async (req, res) => {
  const db = getDb();
  const products = await db.all(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1 ORDER BY c.name, p.name
  `);

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory-report.pdf"');
  doc.pipe(res);

  doc.fontSize(22).fillColor('#D2691E').text('Sandycaffee', { align: 'center' });
  doc.fontSize(16).fillColor('#333').text('Inventory Report', { align: 'center' });
  doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
  doc.moveDown(1.5);

  const lowStock = products.filter(p => p.stock <= p.min_stock);
  doc.fontSize(12).fillColor('#333');
  doc.text(`Total Products: ${products.length}   Low Stock Items: ${lowStock.length}`);
  doc.moveDown(1);

  const tableTop = doc.y;
  const col = [50, 200, 290, 370, 430, 490];
  doc.fontSize(10).fillColor('#fff').rect(50, tableTop, 500, 18).fill('#8B4513');
  doc.fillColor('#fff').text('Product', col[0], tableTop + 4);
  doc.text('Category', col[1], tableTop + 4);
  doc.text('Price', col[2], tableTop + 4);
  doc.text('Stock', col[3], tableTop + 4);
  doc.text('Min', col[4], tableTop + 4);
  doc.text('Status', col[5], tableTop + 4);

  let y = tableTop + 22;
  products.forEach((p, i) => {
    if (y > 700) { doc.addPage(); y = 50; }
    const bg = i % 2 === 0 ? '#f9f9f9' : '#fff';
    doc.rect(50, y, 500, 16).fill(bg);
    const status = p.stock <= p.min_stock ? 'LOW' : 'OK';
    const statusColor = p.stock <= p.min_stock ? '#e53e3e' : '#38a169';
    doc.fillColor('#333').fontSize(9);
    doc.text(p.name, col[0], y + 3, { width: 140 });
    doc.text(p.category_name || '-', col[1], y + 3, { width: 80 });
    doc.text(`£${p.price.toFixed(2)}`, col[2], y + 3);
    doc.text(String(p.stock), col[3], y + 3);
    doc.text(String(p.min_stock), col[4], y + 3);
    doc.fillColor(statusColor).text(status, col[5], y + 3);
    y += 18;
  });

  doc.end();
});

module.exports = router;
