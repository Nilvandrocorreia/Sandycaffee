const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/users
router.get('/', requireAdmin, async (req, res) => {
  const db = getDb();
  const users = await db.all('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC');
  res.json(users);
});

// POST /api/users
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const db = getDb();
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = await db.run(
    'INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)',
    [name, email, hash, role]
  );
  const user = await db.get('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [result.lastID]);
  res.status(201).json(user);
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, email, role, active, password } = req.body;
  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await db.run(
      'UPDATE users SET name=?, email=?, role=?, active=?, password=? WHERE id=?',
      [name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, hash, user.id]
    );
  } else {
    await db.run(
      'UPDATE users SET name=?, email=?, role=?, active=? WHERE id=?',
      [name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, user.id]
    );
  }
  const updated = await db.get('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [user.id]);
  res.json(updated);
});

// DELETE /api/users/:id (deactivate)
router.delete('/:id', requireAdmin, async (req, res) => {
  const db = getDb();
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await db.run('UPDATE users SET active = 0 WHERE id = ?', [user.id]);
  res.json({ success: true, message: 'User deactivated' });
});

module.exports = router;
