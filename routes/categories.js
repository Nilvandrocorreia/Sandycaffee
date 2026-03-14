const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/categories
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(categories);
});

// POST /api/categories
router.post('/', requireAdmin, (req, res) => {
  const { name, emoji, colour, sends_to_kitchen } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(
    'INSERT INTO categories (name, emoji, colour, sends_to_kitchen) VALUES (?, ?, ?, ?)'
  ).run(name, emoji || '🍽️', colour || '#FF8C00', sends_to_kitchen ? 1 : 0);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(category);
});

// PUT /api/categories/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { name, emoji, colour, sends_to_kitchen } = req.body;
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  db.prepare('UPDATE categories SET name=?, emoji=?, colour=?, sends_to_kitchen=? WHERE id=?')
    .run(
      name || category.name,
      emoji || category.emoji,
      colour || category.colour,
      sends_to_kitchen !== undefined ? (sends_to_kitchen ? 1 : 0) : category.sends_to_kitchen,
      category.id
    );
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(category.id);
  res.json(updated);
});

// DELETE /api/categories/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  const inUse = db.prepare('SELECT id FROM products WHERE category_id = ? LIMIT 1').get(category.id);
  if (inUse) return res.status(400).json({ error: 'Category is in use by products' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
  res.json({ success: true });
});

module.exports = router;
