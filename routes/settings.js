const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

function detectLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// GET /api/settings/base-url  (no auth — needed by tables page on load)
router.get('/base-url', (req, res) => {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'base_url'").get();
  const detectedIp = detectLocalIP();
  const port = process.env.PORT || 3000;
  const detectedUrl = `http://${detectedIp}:${port}`;
  res.json({
    base_url: setting ? setting.value : detectedUrl,
    detected_url: detectedUrl,
    is_custom: !!setting
  });
});

// PUT /api/settings/base-url
router.put('/base-url', requireAdmin, (req, res) => {
  let { base_url } = req.body;
  if (!base_url) return res.status(400).json({ error: 'base_url is required' });
  base_url = base_url.trim().replace(/\/$/, '');
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('base_url', ?)").run(base_url);
  console.log(`[SETTINGS] BASE_URL updated to: ${base_url}`);
  res.json({ base_url });
});

module.exports = { router, detectLocalIP };
