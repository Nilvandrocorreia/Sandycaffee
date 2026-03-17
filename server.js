const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], exposedHeaders: ['X-Refresh-Token'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/settings', require('./routes/settings').router);
app.use('/api/orders', require('./routes/orders'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));

// Customer QR page
app.get('/table/:tableNumber', (req, res) => {
  console.log(`[QR] Customer page requested for table #${req.params.tableNumber} from ${req.ip}`);
  res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const { initDb } = require('./database/db');
const seed = require('./database/seed');
const { detectLocalIP } = require('./routes/settings');

async function resetTransactionalData(db) {
  console.log('[RESET] RESET_DB=true detected — clearing transactional data...');
  await db.exec('PRAGMA foreign_keys = OFF');
  await db.exec(`
    DELETE FROM order_items;
    DELETE FROM sales;
    DELETE FROM orders;
    DELETE FROM stock_movements;
    DELETE FROM sqlite_sequence WHERE name IN ('orders', 'order_items', 'sales', 'stock_movements');
  `);
  await db.run("UPDATE tables SET status = 'available'");
  await db.exec('PRAGMA foreign_keys = ON');
  console.log('[RESET] Transactional data cleared. Orders, sales and stock movements reset to zero.');
}

async function start() {
  await initDb();

  if (process.env.RESET_DB === 'true') {
    const db = require('./database/db').getDb();
    await resetTransactionalData(db);
  }

  await seed();

  // If BASE_URL env var is set (e.g. on Railway), persist it to the DB automatically
  if (process.env.BASE_URL) {
    const db = require('./database/db').getDb();
    const envUrl = process.env.BASE_URL.trim().replace(/\/$/, '');
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('base_url', ?)", [envUrl]);
    console.log(`[SETTINGS] BASE_URL locked from environment: ${envUrl}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    const localIP = detectLocalIP();
    console.log(`☕ Sandycaffee POS running on http://localhost:${PORT}`);
    if (process.env.BASE_URL) {
      console.log(`🌐 Production BASE_URL (env): ${process.env.BASE_URL}`);
    } else {
      console.log(`📱 Mobile / LAN access:   http://${localIP}:${PORT}`);
      console.log(`🔗 Customer QR base URL:  http://${localIP}:${PORT}  (set in Tables & QR page)`);
    }
  });
}

start().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
