const express = require('express');
const router = express.Router();
const os = require('os');
const { getDb } = require('../database/db');
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
router.get('/base-url', async (req, res) => {
  const db = getDb();
  const setting = await db.get("SELECT value FROM settings WHERE key = 'base_url'");
  const detectedIp = detectLocalIP();
  const port = process.env.PORT || 3000;
  const detectedUrl = `http://${detectedIp}:${port}`;
  const envUrl = process.env.BASE_URL ? process.env.BASE_URL.trim().replace(/\/$/, '') : null;
  const activeUrl = envUrl || (setting ? setting.value : detectedUrl);
  res.json({
    base_url: activeUrl,
    detected_url: detectedUrl,
    env_url: envUrl,
    is_custom: !!setting,
    is_env_locked: !!envUrl
  });
});

// PUT /api/settings/base-url
router.put('/base-url', requireAdmin, async (req, res) => {
  // If BASE_URL is forced via environment, block manual changes
  if (process.env.BASE_URL) {
    return res.status(403).json({ error: 'BASE_URL is set via environment variable and cannot be changed here. Update it in your Railway environment settings.' });
  }
  let { base_url } = req.body;
  if (!base_url) return res.status(400).json({ error: 'base_url is required' });
  base_url = base_url.trim().replace(/\/$/, '');
  const db = getDb();
  await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('base_url', ?)", [base_url]);
  console.log(`[SETTINGS] BASE_URL updated to: ${base_url}`);
  res.json({ base_url });
});

module.exports = { router, detectLocalIP };
