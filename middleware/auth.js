const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sandycaffee_jwt_secret_2024';
const TOKEN_EXPIRY = '24h';
const REFRESH_THRESHOLD_SECS = 12 * 60 * 60; // refresh when <12h left

function issueToken(payload) {
  return jwt.sign(
    { id: payload.id, name: payload.name, role: payload.role, email: payload.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Sliding refresh: if <12h left, issue a fresh 24h token
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp - now < REFRESH_THRESHOLD_SECS) {
      res.set('X-Refresh-Token', issueToken(decoded));
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'administrator') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

function requireCashier(req, res, next) {
  authenticate(req, res, () => {
    if (!['administrator', 'cashier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Cashier access required' });
    }
    next();
  });
}

function requireKitchen(req, res, next) {
  authenticate(req, res, () => {
    if (!['administrator', 'kitchen', 'cashier'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Kitchen access required' });
    }
    next();
  });
}

module.exports = { authenticate, requireAdmin, requireCashier, requireKitchen, issueToken };
