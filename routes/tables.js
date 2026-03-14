const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const QRCode = require('qrcode');

function getBaseUrl() {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'base_url'").get();
  if (setting) return setting.value;
  // Auto-detect local IP as fallback
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return `http://${iface.address}:${process.env.PORT || 3000}`;
      }
    }
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}

async function generateQR(tableNumber) {
  const url = `${getBaseUrl()}/table/${tableNumber}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    console.log(`[QR] Generated QR for table ${tableNumber}: ${url}`);
    return dataUrl;
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
}

// GET /api/tables/public/:tableNumber — no auth required, includes status
router.get('/public/:tableNumber', (req, res) => {
  const table = db.prepare('SELECT id, number, name, status FROM tables WHERE number = ? AND active = 1').get(parseInt(req.params.tableNumber));
  if (!table) return res.status(404).json({ error: 'Table not found' });
  res.json(table);
});

// GET /api/tables
router.get('/', authenticate, (req, res) => {
  const tables = db.prepare('SELECT * FROM tables ORDER BY number').all();
  res.json(tables);
});

// POST /api/tables/:id/release — cashier releases table after payment
router.post('/:id/release', authenticate, (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(table.id);
  // Mark all non-completed orders on this table as completed
  db.prepare("UPDATE orders SET status='completed', updated_at=datetime('now') WHERE table_id=? AND status NOT IN ('completed')").run(table.id);
  console.log(`[TABLE] Table #${table.id} (${table.name}) released → available`);
  res.json({ success: true, table_id: table.id });
});

// POST /api/tables/:id/request-bill — customer requests bill (no auth)
router.post('/:id/request-bill', (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  db.prepare("UPDATE tables SET status = 'bill-requested' WHERE id = ?").run(table.id);
  console.log(`[TABLE] Table #${table.id} (${table.name}) → bill requested`);
  res.json({ success: true });
});

// POST /api/tables/regenerate-qr — regenerate QR codes for all tables with current BASE_URL
router.post('/regenerate-qr', requireAdmin, async (req, res) => {
  const tables = db.prepare('SELECT * FROM tables').all();
  let count = 0;
  for (const t of tables) {
    const qr = await generateQR(t.number);
    if (qr) {
      db.prepare('UPDATE tables SET qr_code = ? WHERE id = ?').run(qr, t.id);
      count++;
    }
  }
  console.log(`[QR] Regenerated QR codes for ${count} table(s) using BASE_URL: ${getBaseUrl()}`);
  res.json({ success: true, regenerated: count, base_url: getBaseUrl() });
});

// POST /api/tables
router.post('/', requireAdmin, async (req, res) => {
  const { number, name } = req.body;
  if (!number || !name) return res.status(400).json({ error: 'Number and name are required' });
  const existing = db.prepare('SELECT id FROM tables WHERE number = ?').get(parseInt(number));
  if (existing) return res.status(400).json({ error: 'Table number already exists' });
  const qr = await generateQR(number);
  const result = db.prepare('INSERT INTO tables (number, name, qr_code, active) VALUES (?, ?, ?, 1)')
    .run(parseInt(number), name, qr);
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(table);
});

// PUT /api/tables/:id
router.put('/:id', requireAdmin, async (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  const { name, active } = req.body;
  db.prepare('UPDATE tables SET name=?, active=? WHERE id=?')
    .run(name || table.name, active !== undefined ? parseInt(active) : table.active, table.id);
  const updated = db.prepare('SELECT * FROM tables WHERE id = ?').get(table.id);
  res.json(updated);
});

// DELETE /api/tables/:id
router.delete('/:id', requireAdmin, (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  db.prepare('DELETE FROM tables WHERE id = ?').run(table.id);
  res.json({ success: true });
});

// GET /api/tables/:id/qr — returns QR as PNG image
router.get('/:id/qr', authenticate, async (req, res) => {
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  if (!table) return res.status(404).json({ error: 'Table not found' });
  if (table.qr_code) {
    const base64 = table.qr_code.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    res.set('Content-Type', 'image/png');
    return res.send(buf);
  }
  const url = `${getBaseUrl()}/table/${table.number}`;
  QRCode.toBuffer(url, { width: 300 }, (err, buf) => {
    if (err) return res.status(500).json({ error: 'QR generation failed' });
    res.set('Content-Type', 'image/png');
    res.send(buf);
  });
});

module.exports = router;
