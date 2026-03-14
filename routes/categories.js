const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/categories
router.get('/', async (req, res) => {
  const db = getDb();
  const categories = await db.all('SELECT * FROM categories ORDER BY name');
  res.json(categories);
});

// POST /api/categories
router.post('/', requireAdmin, async (req, res) => {
  const { name, emoji, colour, sends_to_kitchen } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const db = getDb();
  const result = await db.run(
    'INSERT INTO categories (name, emoji, colour, sends_to_kitchen) VALUES (?, ?, ?, ?)',
    [name, emoji || '🍽️', colour || '#FF8C00', sends_to_kitchen ? 1 : 0]
  );
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
  res.status(201).json(category);
});

// PUT /api/categories/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, emoji, colour, sends_to_kitchen } = req.body;
  const db = getDb();
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  await db.run(
    'UPDATE categories SET name=?, emoji=?, colour=?, sends_to_kitchen=? WHERE id=?',
    [
      name || category.name,
      emoji || category.emoji,
      colour || category.colour,
      sends_to_kitchen !== undefined ? (sends_to_kitchen ? 1 : 0) : category.sends_to_kitchen,
      category.id
    ]
  );
  const updated = await db.get('SELECT * FROM categories WHERE id = ?', [category.id]);
  res.json(updated);
});

// DELETE /api/categories/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  const db = getDb();
  const category = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  const inUse = await db.get('SELECT id FROM products WHERE category_id = ? LIMIT 1', [category.id]);
  if (inUse) return res.status(400).json({ error: 'Category is in use by products' });
  await db.run('DELETE FROM categories WHERE id = ?', [category.id]);
  res.json({ success: true });
});

module.exports = router;
