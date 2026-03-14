const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'product_' + Date.now() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/products
router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji, c.colour as category_colour
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.name
  `).all();
  res.json(products);
});

// GET /api/products/low-stock
router.get('/low-stock', authenticate, (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock AND p.active = 1
    ORDER BY p.stock ASC
  `).all();
  res.json(products);
});

// POST /api/products
router.post('/', requireAdmin, upload.single('photo'), (req, res) => {
  const { name, price, category_id, stock, min_stock } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const photo = req.file ? '/uploads/' + req.file.filename : null;
  const result = db.prepare(
    'INSERT INTO products (name, price, category_id, photo, stock, min_stock, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  ).run(name, parseFloat(price), category_id || null, photo, parseInt(stock) || 0, parseInt(min_stock) || 5);
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji, c.colour as category_colour
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(product);
});

// PUT /api/products/:id
router.put('/:id', requireAdmin, upload.single('photo'), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const { name, price, category_id, stock, min_stock, active } = req.body;
  const photo = req.file ? '/uploads/' + req.file.filename : product.photo;
  db.prepare(
    'UPDATE products SET name=?, price=?, category_id=?, photo=?, stock=?, min_stock=?, active=? WHERE id=?'
  ).run(
    name || product.name,
    price !== undefined ? parseFloat(price) : product.price,
    category_id !== undefined ? category_id : product.category_id,
    photo,
    stock !== undefined ? parseInt(stock) : product.stock,
    min_stock !== undefined ? parseInt(min_stock) : product.min_stock,
    active !== undefined ? parseInt(active) : product.active,
    product.id
  );
  const updated = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji, c.colour as category_colour
    FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?
  `).get(product.id);
  res.json(updated);
});

// DELETE /api/products/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(product.id);
  res.json({ success: true });
});

module.exports = router;
