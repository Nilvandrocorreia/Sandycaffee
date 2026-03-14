const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/meals  (public — needed by customer QR page)
router.get('/', async (req, res) => {
  const db = getDb();
  const meals = await db.all('SELECT * FROM meals ORDER BY name');
  const result = await Promise.all(meals.map(async meal => {
    const items = await db.all(`
      SELECT mi.*, p.name as product_name, p.price as product_price
      FROM meal_items mi
      JOIN products p ON mi.product_id = p.id
      WHERE mi.meal_id = ?
    `, [meal.id]);
    return { ...meal, items };
  }));
  res.json(result);
});

// POST /api/meals
router.post('/', requireAdmin, async (req, res) => {
  const { name, price, description, items } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required' });
  }
  const db = getDb();
  const mealResult = await db.run(
    'INSERT INTO meals (name, price, description, active) VALUES (?, ?, ?, 1)',
    [name, parseFloat(price), description || '']
  );

  const mealId = mealResult.lastID;
  if (items && Array.isArray(items)) {
    for (const item of items) {
      await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [mealId, item.product_id, item.quantity || 1]);
    }
  }

  const meal = await db.get('SELECT * FROM meals WHERE id = ?', [mealId]);
  const mealItems = await db.all(`
    SELECT mi.*, p.name as product_name, p.price as product_price
    FROM meal_items mi JOIN products p ON mi.product_id = p.id WHERE mi.meal_id = ?
  `, [mealId]);
  res.status(201).json({ ...meal, items: mealItems });
});

// PUT /api/meals/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const db = getDb();
  const meal = await db.get('SELECT * FROM meals WHERE id = ?', [req.params.id]);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  const { name, price, description, active, items } = req.body;
  await db.run(
    'UPDATE meals SET name=?, price=?, description=?, active=? WHERE id=?',
    [
      name || meal.name,
      price !== undefined ? parseFloat(price) : meal.price,
      description !== undefined ? description : meal.description,
      active !== undefined ? parseInt(active) : meal.active,
      meal.id
    ]
  );

  if (items && Array.isArray(items)) {
    await db.run('DELETE FROM meal_items WHERE meal_id = ?', [meal.id]);
    for (const item of items) {
      await db.run('INSERT INTO meal_items (meal_id, product_id, quantity) VALUES (?, ?, ?)', [meal.id, item.product_id, item.quantity || 1]);
    }
  }

  const updated = await db.get('SELECT * FROM meals WHERE id = ?', [meal.id]);
  const mealItems = await db.all(`
    SELECT mi.*, p.name as product_name, p.price as product_price
    FROM meal_items mi JOIN products p ON mi.product_id = p.id WHERE mi.meal_id = ?
  `, [meal.id]);
  res.json({ ...updated, items: mealItems });
});

// DELETE /api/meals/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  const db = getDb();
  const meal = await db.get('SELECT * FROM meals WHERE id = ?', [req.params.id]);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  await db.run('DELETE FROM meal_items WHERE meal_id = ?', [meal.id]);
  await db.run('DELETE FROM meals WHERE id = ?', [meal.id]);
  res.json({ success: true });
});

module.exports = router;
