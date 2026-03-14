const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/users
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email already exists' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, 1)'
  ).run(name, email, hash, role);
  const user = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, (req, res) => {
  const { name, email, role, active, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let query, params;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    query = 'UPDATE users SET name=?, email=?, role=?, active=?, password=? WHERE id=?';
    params = [name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, hash, user.id];
  } else {
    query = 'UPDATE users SET name=?, email=?, role=?, active=? WHERE id=?';
    params = [name || user.name, email || user.email, role || user.role, active !== undefined ? active : user.active, user.id];
  }
  db.prepare(query).run(...params);
  const updated = db.prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?').get(user.id);
  res.json(updated);
});

// DELETE /api/users/:id (deactivate)
router.delete('/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(user.id);
  res.json({ success: true, message: 'User deactivated' });
});

module.exports = router;
