const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/meals  (public — needed by customer QR page)
router.get('/', (req, res) => {
  const meals = db.prepare('SELECT * FROM meals ORDER BY name').all();
  const result = meals.map(meal => {
    const items = db.prepare(`
      SELECT mi.*, p.name as product_name, p.price as product_price
      FROM meal_items mi
      JOIN products p ON mi.product_id = p.id
      WHERE mi.meal_id = ?
    `).all(meal.id);
    return { ...meal, items };
  });
  res.json(result);
});

// POST /api/meals
router.post('/', requireAdmin, (req, res) => {
  const { name, price, description, items } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const mealResult = db.prepare(
    'INSERT INTO meals (name, price, description, active) VALUES (?, ?, ?, 1)'
  ).run(name, parseFloat(price), description || '');

  const mealId = mealResult.lastInsertRowid;
  if (items && Array.isArray(items)) {
    const insertItem = db.prepare('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const item of items) {
      insertItem.run(mealId, item.product_id, item.quantity || 1);
    }
  }

  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(mealId);
  const mealItems = db.prepare(`
    SELECT mi.*, p.name as product_name, p.price as product_price
    FROM meal_items mi JOIN products p ON mi.product_id = p.id WHERE mi.meal_id = ?
  `).all(mealId);
  res.status(201).json({ ...meal, items: mealItems });
});

// PUT /api/meals/:id
router.put('/:id', requireAdmin, (req, res) => {
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  const { name, price, description, active, items } = req.body;
  db.prepare('UPDATE meals SET name=?, price=?, description=?, active=? WHERE id=?')
    .run(
      name || meal.name,
      price !== undefined ? parseFloat(price) : meal.price,
      description !== undefined ? description : meal.description,
      active !== undefined ? parseInt(active) : meal.active,
      meal.id
    );

  if (items && Array.isArray(items)) {
    db.prepare('DELETE FROM meal_items WHERE meal_id = ?').run(meal.id);
    const insertItem = db.prepare('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const item of items) {
      insertItem.run(meal.id, item.product_id, item.quantity || 1);
    }
  }

  const updated = db.prepare('SELECT * FROM meals WHERE id = ?').get(meal.id);
  const mealItems = db.prepare(`
    SELECT mi.*, p.name as product_name, p.price as product_price
    FROM meal_items mi JOIN products p ON mi.product_id = p.id WHERE mi.meal_id = ?
  `).all(meal.id);
  res.json({ ...updated, items: mealItems });
});

// DELETE /api/meals/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  db.prepare('DELETE FROM meal_items WHERE meal_id = ?').run(meal.id);
  db.prepare('DELETE FROM meals WHERE id = ?').run(meal.id);
  res.json({ success: true });
});

module.exports = router;
