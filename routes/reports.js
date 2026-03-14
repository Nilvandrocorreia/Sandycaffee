const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

function getDateRange(period) {
  const now = new Date();
  let start;
  if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(now);
    start.setMonth(now.getMonth() - 1);
  } else {
    // day
    start = new Date(now.toISOString().split('T')[0]);
  }
  return start.toISOString().split('T')[0];
}

// GET /api/reports/sales?period=day|week|month
router.get('/sales', authenticate, (req, res) => {
  const period = req.query.period || 'day';
  const startDate = getDateRange(period);
  const summary = db.prepare(`
    SELECT COUNT(*) as order_count, COALESCE(SUM(total),0) as total_revenue,
           COALESCE(AVG(total),0) as avg_order_value
    FROM sales WHERE date(created_at) >= ?
  `).get(startDate);

  const daily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as orders, SUM(total) as revenue
    FROM sales WHERE date(created_at) >= ?
    GROUP BY day ORDER BY day
  `).all(startDate);

  res.json({ ...summary, daily, period, start_date: startDate });
});

// GET /api/reports/best-selling
router.get('/best-selling', authenticate, (req, res) => {
  const period = req.query.period || 'day';
  const startDate = getDateRange(period);
  const products = db.prepare(`
    SELECT oi.name, oi.product_id, SUM(oi.quantity) as total_qty,
           SUM(oi.quantity * oi.unit_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN sales s ON s.order_id = o.id
    WHERE date(s.created_at) >= ? AND oi.product_id IS NOT NULL
    GROUP BY oi.product_id, oi.name
    ORDER BY total_qty DESC
    LIMIT 10
  `).all(startDate);
  res.json(products);
});

// GET /api/reports/hourly
router.get('/hourly', authenticate, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const hourly = db.prepare(`
    SELECT strftime('%H', created_at) as hour,
           COUNT(*) as orders, SUM(total) as revenue
    FROM sales WHERE date(created_at) = ?
    GROUP BY hour ORDER BY hour
  `).all(today);

  // Fill in all 24 hours
  const full = [];
  for (let h = 0; h < 24; h++) {
    const hourStr = String(h).padStart(2, '0');
    const found = hourly.find(r => r.hour === hourStr);
    full.push({ hour: hourStr, orders: found ? found.orders : 0, revenue: found ? found.revenue : 0 });
  }
  res.json(full);
});

// GET /api/reports/pdf
router.get('/pdf', authenticate, (req, res) => {
  const period = req.query.period || 'day';
  const startDate = getDateRange(period);

  const summary = db.prepare(`
    SELECT COUNT(*) as order_count, COALESCE(SUM(total),0) as total_revenue,
           COALESCE(AVG(total),0) as avg_order_value
    FROM sales WHERE date(created_at) >= ?
  `).get(startDate);

  const bestSelling = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) as total_qty,
           SUM(oi.quantity * oi.unit_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN sales s ON s.order_id = o.id
    WHERE date(s.created_at) >= ? AND oi.product_id IS NOT NULL
    GROUP BY oi.name ORDER BY total_qty DESC LIMIT 10
  `).all(startDate);

  const daily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as orders, SUM(total) as revenue
    FROM sales WHERE date(created_at) >= ?
    GROUP BY day ORDER BY day
  `).all(startDate);

  const byMethod = db.prepare(`
    SELECT payment_method, COUNT(*) as count, SUM(total) as total
    FROM sales WHERE date(created_at) >= ?
    GROUP BY payment_method
  `).all(startDate);

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sales-report-${period}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fontSize(24).fillColor('#D2691E').text('☕ Sandycaffee', { align: 'center' });
  doc.fontSize(16).fillColor('#333').text('Sales Report', { align: 'center' });
  const periodLabel = period === 'day' ? 'Today' : period === 'week' ? 'Last 7 Days' : 'Last 30 Days';
  doc.fontSize(11).fillColor('#666').text(`Period: ${periodLabel}  |  Generated: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
  doc.moveDown(1.5);

  // Summary
  doc.fontSize(14).fillColor('#8B4513').text('Summary', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#333');
  doc.text(`Total Revenue: £${(summary.total_revenue || 0).toFixed(2)}`);
  doc.text(`Total Orders: ${summary.order_count}`);
  doc.text(`Avg Order Value: £${(summary.avg_order_value || 0).toFixed(2)}`);
  doc.moveDown(1);

  // Payment breakdown
  if (byMethod.length > 0) {
    doc.fontSize(14).fillColor('#8B4513').text('Payment Methods', { underline: true });
    doc.moveDown(0.5);
    byMethod.forEach(m => {
      doc.fontSize(11).fillColor('#333').text(`${m.payment_method.charAt(0).toUpperCase() + m.payment_method.slice(1)}: ${m.count} orders — £${m.total.toFixed(2)}`);
    });
    doc.moveDown(1);
  }

  // Best selling
  if (bestSelling.length > 0) {
    doc.fontSize(14).fillColor('#8B4513').text('Best Selling Products', { underline: true });
    doc.moveDown(0.5);
    const bsTop = doc.y;
    doc.fontSize(9).fillColor('#fff').rect(50, bsTop, 460, 16).fill('#8B4513');
    doc.fillColor('#fff').text('Product', 55, bsTop + 3);
    doc.text('Qty Sold', 300, bsTop + 3);
    doc.text('Revenue', 390, bsTop + 3);
    let y = bsTop + 20;
    bestSelling.forEach((p, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#fff';
      doc.rect(50, y, 460, 15).fill(bg);
      doc.fontSize(9).fillColor('#333');
      doc.text(p.name, 55, y + 3, { width: 230 });
      doc.text(String(p.total_qty), 300, y + 3);
      doc.text(`£${p.total_revenue.toFixed(2)}`, 390, y + 3);
      y += 17;
    });
    doc.moveDown(1);
  }

  // Daily breakdown
  if (daily.length > 0) {
    doc.addPage();
    doc.fontSize(14).fillColor('#8B4513').text('Daily Breakdown', { underline: true });
    doc.moveDown(0.5);
    const dailyTop = doc.y;
    doc.fontSize(9).fillColor('#fff').rect(50, dailyTop, 460, 16).fill('#8B4513');
    doc.fillColor('#fff').text('Date', 55, dailyTop + 3);
    doc.text('Orders', 250, dailyTop + 3);
    doc.text('Revenue', 370, dailyTop + 3);
    let dy = dailyTop + 20;
    daily.forEach((d, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#fff';
      doc.rect(50, dy, 460, 15).fill(bg);
      doc.fontSize(9).fillColor('#333');
      doc.text(d.day, 55, dy + 3);
      doc.text(String(d.orders), 250, dy + 3);
      doc.text(`£${d.revenue.toFixed(2)}`, 370, dy + 3);
      dy += 17;
    });
  }

  doc.end();
});

module.exports = router;
