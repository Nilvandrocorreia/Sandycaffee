const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authenticate, issueToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'sandycaffee_jwt_secret_2024';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const db = getDb();
  const user = await db.get(
    'SELECT * FROM users WHERE (email = ? OR name = ?) AND active = 1',
    [username, username]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = issueToken(user);

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, email: user.email }
  });
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res) => {
  const db = getDb();
  const user = await db.get('SELECT id, name, email, role, active FROM users WHERE id = ? AND active = 1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'User not found or inactive' });
  const token = issueToken(user);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email } });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const db = getDb();
  const user = await db.get('SELECT id, name, email, role, active FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
