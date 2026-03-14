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

async function start() {
  await initDb();
  await seed();
  app.listen(PORT, '0.0.0.0', () => {
    const localIP = detectLocalIP();
    console.log(`☕ Sandycaffee POS running on http://localhost:${PORT}`);
    console.log(`📱 Mobile / LAN access:   http://${localIP}:${PORT}`);
    console.log(`🔗 Customer QR base URL:  http://${localIP}:${PORT}  (set in Tables & QR page)`);
  });
}

start().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
